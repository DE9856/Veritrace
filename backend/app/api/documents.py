"""Upload, list and delete documents in the knowledge base."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Response, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from app.api.deps import ServicesDep
from app.ingestion.library import add_document
from app.ingestion.parser import SUPPORTED_EXTENSIONS, UnsupportedFileError
from app.ingestion.pipeline import EmptyDocumentError
from app.schemas import DocumentOut
from app.store.sqlite import Document

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _to_out(doc: Document) -> DocumentOut:
    return DocumentOut.model_validate(doc, from_attributes=True)


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile, services: ServicesDep, response: Response
) -> DocumentOut:
    filename = Path(file.filename or "upload").name
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported file type {ext or '(none)'}. "
            f"Upload one of: {', '.join(sorted(SUPPORTED_EXTENSIONS))}.",
        )

    data = await file.read()
    max_bytes = services.settings.max_upload_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File is larger than the {services.settings.max_upload_mb} MB limit.",
        )
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The file is empty.")

    try:
        doc, created = await run_in_threadpool(
            add_document,
            services,
            data,
            filename,
            file.content_type or "application/octet-stream",
        )
    except (UnsupportedFileError, EmptyDocumentError) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    if not created:
        # Same bytes already indexed: the existing record, not a duplicate set of chunks.
        response.status_code = status.HTTP_200_OK
    return _to_out(doc)


@router.get("")
def list_documents(services: ServicesDep) -> list[DocumentOut]:
    return [_to_out(d) for d in services.documents.list()]


@router.get("/{document_id}")
def get_document(document_id: str, services: ServicesDep) -> DocumentOut:
    doc = services.documents.get(document_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
    return _to_out(doc)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, services: ServicesDep) -> None:
    doc = services.documents.get(document_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
    services.store.delete_document(document_id)
    services.documents.delete(document_id)
    Path(doc.stored_path).unlink(missing_ok=True)
