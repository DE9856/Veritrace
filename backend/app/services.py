"""Long-lived objects created once at startup and shared by every request."""

from dataclasses import dataclass

from app.config import Settings
from app.ingestion.embedder import Embedder
from app.providers.base import LLMProvider
from app.providers.factory import build_provider
from app.store.chroma import VectorStore
from app.store.sqlite import DocumentRepository


@dataclass
class Services:
    settings: Settings
    provider: LLMProvider
    embedder: Embedder
    store: VectorStore
    documents: DocumentRepository


def build_services(settings: Settings) -> Services:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return Services(
        settings=settings,
        provider=build_provider(settings),
        embedder=Embedder(settings.embedding_model, settings.embedding_device),
        store=VectorStore(settings.chroma_dir, settings.collection_name),
        documents=DocumentRepository(settings.sqlite_path),
    )
