"""Application settings, loaded from environment variables and backend/.env."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # LLM
    llm_provider: str = "ollama"
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "qwen3:4b-instruct"
    llm_temperature: float = 0.2
    llm_timeout_s: float = 180.0

    # Embeddings
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_device: str = "cpu"

    # Storage
    data_dir: Path = BACKEND_DIR / "data"
    collection_name: str = "veritrace_chunks"

    # Ingestion and retrieval
    chunk_tokens: int = 400
    chunk_overlap_tokens: int = 60
    top_k: int = 6
    max_upload_mb: int = 25

    # Verification
    nli_model: str = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"
    nli_device: str = "cpu"
    nli_batch_size: int = 16
    nli_window_sentences: int = 3  # claims are checked against short sentence windows
    nli_windows_per_claim: int = 4  # best-matching windows sent to NLI per claim

    # Phase 2 labels come from the NLI verdict alone. Phase 3 replaces these with
    # the weighted score (entailment, consistency, retrieval, self-label).
    high_threshold: float = 0.75  # entailment at or above this -> high confidence
    inferred_threshold: float = 0.45  # entailment at or above this -> inferred
    contradiction_threshold: float = 0.7  # contradiction at or above this -> hallucinated

    # API
    cors_origins: list[str] = ["http://localhost:3000"]

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def chroma_dir(self) -> Path:
        return self.data_dir / "chroma"

    @property
    def sqlite_path(self) -> Path:
        return self.data_dir / "veritrace.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
