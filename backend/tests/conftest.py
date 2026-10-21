"""Test doubles: a bag-of-words embedder, a word-overlap NLI model and a scripted LLM,
so tests need no downloaded models and no API keys."""

import hashlib
import math
import os
import re

# Use the code defaults, not backend/config.yaml, so tuning the YAML never breaks tests.
os.environ["VERITRACE_CONFIG"] = ""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.providers.base import LLMError
from app.schemas import ProviderHealth
from app.services import Services
from app.store.chroma import VectorStore
from app.store.sqlite import DocumentRepository
from app.verification.nli import NLIScores

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

    def embed_queries(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]


class FakeNLI:
    """Entailment = share of the claim's words found in the premise. Claims listed in
    `contradicted` get a high contradiction score instead."""

    model_name = "fake-nli"

    def __init__(self):
        self.contradicted: set[str] = set()

    def predict(self, pairs):
        results = []
        for premise, claim in pairs:
            if claim in self.contradicted:
                results.append(NLIScores(0.02, 0.08, 0.9))
                continue
            words = set(re.findall(r"[a-z0-9]+", claim.lower()))
            found = set(re.findall(r"[a-z0-9]+", premise.lower()))
            e = len(words & found) / max(len(words), 1)
            results.append(NLIScores(e, 1 - e, 0.0))
        return results


class FakeProvider:
    name = "fake"
    model = "scripted"

    def __init__(self):
        self.reply = "Vikram landed on 23 August 2023. [S1]"
        # Claim extraction result returned by generate_json; None simulates a failure.
        self.extraction: dict | None = {
            "sentences": [{"index": 0, "claims": ["Vikram landed on 23 August 2023."]}]
        }
        # Claims the judge rules derivable; every other judged claim is unsupported.
        self.derivable: set[str] = set()
        self.judged: list[str] = []
        # Resampled answers; None simulates a sampling failure. Defaults to the reply.
        self.samples: list[str] | None = []
        # Extra search queries the planner returns, per call (a list per attempt).
        self.planned: list[list[str]] = []
        self.plans_requested = 0
        self.revision = "A revised answer [S1]."
        self.prompts: list[str] = []

    async def generate(self, prompt, *, system=None, temperature=None):
        self.prompts.append(prompt)
        return self.revision if "Flagged claims:" in prompt else self.reply

    async def stream(self, prompt, *, system=None, temperature=None):
        self.prompts.append(prompt)
        middle = len(self.reply) // 2
        for piece in (self.reply[:middle], self.reply[middle:]):
            yield piece

    async def generate_json(self, prompt, schema, *, system=None):
        if schema.__name__ == "_SearchPlan":
            plan = (
                self.planned[self.plans_requested]
                if self.plans_requested < len(self.planned)
                else []
            )
            self.plans_requested += 1
            return schema.model_validate({"queries": plan})
        if schema.__name__ == "_Judgement":
            claims = re.findall(r"^(\d+): (.+)$", prompt.split("Claims:")[1], re.MULTILINE)
            self.judged.extend(text for _, text in claims)
            return schema.model_validate(
                {
                    "claims": [
                        {
                            "id": int(i),
                            "verdict": "derivable" if text in self.derivable else "unsupported",
                            "reason": "scripted",
                        }
                        for i, text in claims
                    ]
                }
            )
        if self.extraction is None:
            raise LLMError("scripted failure")
        return schema.model_validate(self.extraction)

    async def sample(self, prompt, n, *, system=None, temperature=0.8):
        if self.samples is None:
            raise LLMError("scripted failure")
        return (self.samples or [self.reply] * n)[:n]

    async def health(self):
        return ProviderHealth(
            provider="fake", model="scripted", reachable=True, model_available=True
        )


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        data_dir=tmp_path / "data",
        chunk_tokens=40,
        chunk_overlap_tokens=8,
        # The bag-of-words embedder gives lower similarities than bge; 0.55 is tuned for bge.
        evidence_threshold=0.2,
    )


@pytest.fixture
def provider() -> FakeProvider:
    return FakeProvider()


@pytest.fixture
def nli() -> FakeNLI:
    return FakeNLI()


@pytest.fixture
def client(settings, provider, nli):
    def factory(s: Settings) -> Services:
        s.uploads_dir.mkdir(parents=True, exist_ok=True)
        return Services(
            settings=s,
            provider=provider,
            embedder=FakeEmbedder(),
            nli=nli,
            store=VectorStore(s.chroma_dir, s.collection_name),
            documents=DocumentRepository(s.sqlite_path),
        )

    with TestClient(create_app(settings, services_factory=factory)) as c:
        yield c
