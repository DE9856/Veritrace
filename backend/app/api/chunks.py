"""Fetch a single source chunk, used by the citation viewer."""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import ServicesDep
from app.schemas import ChunkOut

router = APIRouter(prefix="/api/chunks", tags=["chunks"])


@router.get("/{chunk_id}")
def get_chunk(chunk_id: str, services: ServicesDep) -> ChunkOut:
    chunk = services.store.get_chunk(chunk_id)
    if not chunk:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chunk not found.")
    return ChunkOut(
        chunk_id=chunk.chunk_id,
        document_id=chunk.document_id,
        filename=chunk.filename,
        page=chunk.page,
        chunk_index=chunk.chunk_index,
        text=chunk.text,
    )
