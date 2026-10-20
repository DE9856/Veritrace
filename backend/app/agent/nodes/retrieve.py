"""Retrieve node: runs every planned search query, merges the hits and labels the best
chunks S1..Sk."""

import asyncio

from app.ingestion.embedder import Embedder
from app.schemas import SourceChunk
from app.store.chroma import StoredChunk, VectorStore


async def retrieve(
    question: str,
    *,
    embedder: Embedder,
    store: VectorStore,
    k: int,
    document_ids: list[str] | None = None,
) -> list[SourceChunk]:
    return await retrieve_many(
        [question], embedder=embedder, store=store, k=k, document_ids=document_ids
    )


async def retrieve_many(
    queries: list[str],
    *,
    embedder: Embedder,
    store: VectorStore,
    k: int,
    document_ids: list[str] | None = None,
) -> list[SourceChunk]:
    """Search with each query and keep the k chunks with the highest similarity to any of
    them, so a rephrased query can surface a passage the original wording missed."""

    def search() -> list[StoredChunk]:
        best: dict[str, StoredChunk] = {}
        for vector in embedder.embed_queries(queries):
            for hit in store.query(vector, k, document_ids):
                kept = best.get(hit.chunk_id)
                if kept is None or (hit.similarity or 0) > (kept.similarity or 0):
                    best[hit.chunk_id] = hit
        return sorted(best.values(), key=lambda h: h.similarity or 0, reverse=True)[:k]

    # Embedding and the Chroma queries are CPU-bound; keep them off the event loop.
    hits = await asyncio.to_thread(search)
    return [
        SourceChunk(
            label=f"S{i}",
            chunk_id=h.chunk_id,
            document_id=h.document_id,
            filename=h.filename,
            title=h.title,
            page=h.page,
            text=h.text,
            similarity=round(h.similarity or 0.0, 4),
        )
        for i, h in enumerate(hits, 1)
    ]
