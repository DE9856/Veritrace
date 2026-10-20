"""ChromaDB wrapper. We embed text ourselves, so Chroma only stores vectors and metadata."""

from dataclasses import dataclass
from pathlib import Path

import chromadb

from app.ingestion.chunker import Chunk


@dataclass
class StoredChunk:
    chunk_id: str
    document_id: str
    filename: str
    page: int
    chunk_index: int
    text: str
    similarity: float | None = None  # set for query results only


def chunk_id(document_id: str, chunk: Chunk) -> str:
    return f"{document_id}_p{chunk.page}_c{chunk.index}"


class VectorStore:
    def __init__(self, path: Path, collection_name: str):
        path.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=str(path))
        self._collection = self._client.get_or_create_collection(
            name=collection_name,
            configuration={"hnsw": {"space": "cosine"}},
            embedding_function=None,
        )

    def add_chunks(
        self,
        document_id: str,
        filename: str,
        chunks: list[Chunk],
        embeddings: list[list[float]],
    ) -> None:
        if not chunks:
            return
        self._collection.add(
            ids=[chunk_id(document_id, c) for c in chunks],
            embeddings=embeddings,
            documents=[c.text for c in chunks],
            metadatas=[
                {
                    "document_id": document_id,
                    "filename": filename,
                    "page": c.page,
                    "chunk_index": c.index,
                    "token_count": c.token_count,
                }
                for c in chunks
            ],
        )

    def query(
        self, embedding: list[float], k: int, document_ids: list[str] | None = None
    ) -> list[StoredChunk]:
        if self.count() == 0:
            return []
        where = None
        if document_ids:
            where = (
                {"document_id": document_ids[0]}
                if len(document_ids) == 1
                else {"document_id": {"$in": document_ids}}
            )
        result = self._collection.query(
            query_embeddings=[embedding],
            n_results=k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        return [
            _to_stored(cid, doc, meta, similarity=1.0 - dist)
            for cid, doc, meta, dist in zip(
                result["ids"][0],
                result["documents"][0],
                result["metadatas"][0],
                result["distances"][0],
                strict=True,
            )
        ]

    def get_chunk(self, chunk_id: str) -> StoredChunk | None:
        result = self._collection.get(ids=[chunk_id], include=["documents", "metadatas"])
        if not result["ids"]:
            return None
        return _to_stored(result["ids"][0], result["documents"][0], result["metadatas"][0])

    def delete_document(self, document_id: str) -> None:
        self._collection.delete(where={"document_id": document_id})

    def count(self) -> int:
        return self._collection.count()


def _to_stored(cid: str, text: str, meta: dict, similarity: float | None = None) -> StoredChunk:
    return StoredChunk(
        chunk_id=cid,
        document_id=meta["document_id"],
        filename=meta["filename"],
        page=int(meta["page"]),
        chunk_index=int(meta["chunk_index"]),
        text=text,
        similarity=similarity,
    )
