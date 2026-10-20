"""Adding documents to the knowledge base, shared by the upload API and startup seeding."""

import hashlib
import logging
import uuid
from pathlib import Path

from app.config import BACKEND_DIR
from app.ingestion.pipeline import ingest_file
from app.services import Services
from app.store.sqlite import Document

log = logging.getLogger(__name__)
SAMPLES_DIR = BACKEND_DIR / "samples"


def add_document(
    services: Services, data: bytes, filename: str, content_type: str
) -> tuple[Document, bool]:
    """Store, index and record a file. Returns (document, created); identical bytes that
    are already indexed return the existing record. Ingestion errors propagate, and leave
    nothing behind."""
    sha256 = hashlib.sha256(data).hexdigest()
    existing = services.documents.find_by_hash(sha256)
    if existing:
        return existing, False

    document_id = uuid.uuid4().hex[:12]
    stored_path = services.settings.uploads_dir / f"{document_id}{Path(filename).suffix.lower()}"
    stored_path.write_bytes(data)
    try:
        result = ingest_file(
            stored_path,
            document_id=document_id,
            filename=filename,
            embedder=services.embedder,
            store=services.store,
            settings=services.settings,
        )
    except Exception:
        stored_path.unlink(missing_ok=True)
        raise

    document = services.documents.add(
        Document(
            id=document_id,
            filename=filename,
            content_type=content_type,
            sha256=sha256,
            stored_path=str(stored_path),
            pages=result.pages,
            chunks=result.chunks,
            size_bytes=len(data),
        )
    )
    return document, True


def seed_samples(services: Services) -> int:
    """Index the bundled sample documents if the knowledge base is empty. Used on hosts
    whose disk is wiped on restart, so a fresh deployment is ready to try."""
    if services.documents.count() > 0:
        return 0
    added = 0
    for path in sorted(SAMPLES_DIR.glob("*.md")):
        add_document(services, path.read_bytes(), path.name, "text/markdown")
        added += 1
    log.info("Seeded %d sample documents", added)
    return added
