"""Parse -> chunk -> embed -> store, for one uploaded file."""

from dataclasses import dataclass
from pathlib import Path

from app.config import Settings
from app.ingestion.chunker import chunk_pages
from app.ingestion.embedder import Embedder
from app.ingestion.parser import parse_file
from app.store.chroma import VectorStore


class EmptyDocumentError(ValueError):
    pass


@dataclass
class IngestResult:
    pages: int
    chunks: int


def ingest_file(
    path: Path,
    *,
    document_id: str,
    filename: str,
    embedder: Embedder,
    store: VectorStore,
    settings: Settings,
) -> IngestResult:
    pages = parse_file(path)
    if not pages:
        raise EmptyDocumentError(
            "No text could be extracted. Scanned PDFs need OCR, which is not supported yet."
        )
    chunks = chunk_pages(
        pages,
        count=embedder.count_tokens,
        max_tokens=settings.chunk_tokens,
        overlap_tokens=settings.chunk_overlap_tokens,
    )
    embeddings = embedder.embed_documents([c.text for c in chunks])
    try:
        store.add_chunks(document_id, filename, chunks, embeddings)
    except Exception:
        store.delete_document(document_id)  # never leave half a document indexed
        raise
    return IngestResult(pages=len(pages), chunks=len(chunks))
