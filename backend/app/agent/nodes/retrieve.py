"""Retrieve node: finds the chunks most relevant to the question and labels them S1..Sk."""

import asyncio

from app.ingestion.embedder import Embedder
from app.schemas import SourceChunk
from app.store.chroma import VectorStore


async def retrieve(
    question: str,
    *,
    embedder: Embedder,
    store: VectorStore,
    k: int,
    document_ids: list[str] | None = None,
) -> list[SourceChunk]:
    # Embedding and the Chroma query are CPU-bound; keep them off the event loop.
    embedding = await asyncio.to_thread(embedder.embed_query, question)
    hits = await asyncio.to_thread(store.query, embedding, k, document_ids)
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
