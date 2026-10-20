"""Test doubles: a bag-of-words embedder and a scripted LLM, so tests need no models or Ollama."""

import hashlib
import math
import re

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import ProviderHealth
from app.services import Services
from app.store.chroma import VectorStore
from app.store.sqlite import DocumentRepository

DIM = 256


class FakeEmbedder:
    model_name = "fake-bow"

    def count_tokens(self, text: str) -> int:
        return len(text.split())

    def _embed(self, text: str) -> list[float]:
        vec = [0.0] * DIM
        for word in re.findall(r"[a-z0-9]+", text.lower()):
            vec[int(hashlib.md5(word.encode()).hexdigest(), 16) % DIM] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)


class FakeProvider:
    name = "fake"
    model = "scripted"

    def __init__(self):
        self.reply = "Vikram landed on 23 August 2023. [S1]"
        self.prompts: list[str] = []

    async def generate(self, prompt, *, system=None, temperature=None):
        self.prompts.append(prompt)
        return self.reply

    async def generate_json(self, prompt, schema, *, system=None):
        raise NotImplementedError

    async def sample(self, prompt, n, *, system=None, temperature=0.8):
        return [self.reply] * n

    async def health(self):
        return ProviderHealth(
            provider="fake", model="scripted", reachable=True, model_available=True
        )


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None, data_dir=tmp_path / "data", chunk_tokens=40, chunk_overlap_tokens=8
    )


@pytest.fixture
def provider() -> FakeProvider:
    return FakeProvider()


@pytest.fixture
def client(settings, provider):
    def factory(s: Settings) -> Services:
        s.uploads_dir.mkdir(parents=True, exist_ok=True)
        return Services(
            settings=s,
            provider=provider,
            embedder=FakeEmbedder(),
            store=VectorStore(s.chroma_dir, s.collection_name),
            documents=DocumentRepository(s.sqlite_path),
        )

    with TestClient(create_app(settings, services_factory=factory)) as c:
        yield c
