"""Application settings.

Sources, highest priority first: constructor arguments, environment variables,
backend/.env, then backend/config.yaml (scoring weights and thresholds).
"""

import os
from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
    YamlConfigSettingsSource,
)

BACKEND_DIR = Path(__file__).resolve().parent.parent
# Set VERITRACE_CONFIG to another YAML file, or to an empty string to use code defaults only.
DEFAULT_CONFIG_YAML = BACKEND_DIR / "config.yaml"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # LLM
    llm_provider: str = "groq"
    llm_temperature: float = 0.2
    llm_timeout_s: float = 180.0
    # Comma-separated, tried in order when the providers before are rate limited. A name
    # whose key is not set is skipped.
    llm_fallback: str = "groq_backup,gemini"

    # Gemini (LLM_PROVIDER=gemini). Keys are SecretStr so they never appear in logs.
    gemini_api_key: SecretStr | None = None
    # gemini-2.5-* is closed to new keys; 3.5-flash accepts thinking_budget=0 (the lite
    # models reject it) and answered in about 6 s per call in testing.
    gemini_model: str = "gemini-3.5-flash"
    gemini_requests_per_minute: int = 10  # free-tier limit for the model; paced client-side
    gemini_thinking_budget: int | None = 0  # 0 turns thinking off; None keeps the default

    # Groq, the fallback (or LLM_PROVIDER=groq). Any OpenAI-compatible API works here.
    groq_api_key: SecretStr | None = None
    # A second Groq account (LLM_FALLBACK=groq_backup), with its own daily quota
    groq_backup_api_key: SecretStr | None = None
    # Groq retired the Llama 3.3 models. gpt-oss-120b answered in 1-2 s and handles JSON
    # mode; qwen3.8-27b is faster but failed JSON validation in testing.
    groq_model: str = "openai/gpt-oss-120b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_requests_per_minute: int = 30
    # Free tier: 1000 requests a day but only 8000 tokens a minute, which counts the hidden
    # reasoning of gpt-oss models. "low" keeps a question well under that.
    groq_reasoning_effort: str | None = "low"

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
    # Agent retrieval loop: below this best similarity the agent rewrites its queries and
    # searches again, at most max_retrieval_retries times. Measured with bge-small on the
    # sample documents: on-topic questions 0.53-0.73, off-topic 0.40-0.56.
    evidence_threshold: float = 0.55
    max_retrieval_retries: int = 2
    max_upload_mb: int = 25
    seed_samples: bool = False  # index backend/samples at startup if the store is empty

    # Verification
    nli_model: str = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"
    nli_device: str = "cpu"
    nli_batch_size: int = 16
    nli_window_sentences: int = 3  # claims are checked against short sentence windows
    nli_windows_per_claim: int = 4  # best-matching windows sent to NLI per claim

    # Extra signals
    consistency_samples: int = 3  # resampled answers per question; 0 turns the check off
    sample_temperature: float = 0.8
    judge_enabled: bool = True  # LLM inference judge for claims NLI could not confirm

    # Confidence score = weighted average of the available signals (see config.yaml)
    weight_entailment: float = 0.65
    weight_consistency: float = 0.15
    weight_retrieval: float = 0.10
    weight_self_label: float = 0.10
    # Claim-to-evidence cosine similarity is mapped linearly from this range onto 0..1
    relevance_floor: float = 0.5
    relevance_ceiling: float = 0.9

    # Labels
    high_threshold: float = 0.75  # score at or above this -> high confidence
    inferred_threshold: float = 0.45  # score (and entailment) at or above this -> inferred
    contradiction_threshold: float = 0.7  # contradiction at or above this -> hallucinated
    strong_entailment: float = 0.85  # with consistent samples, always high confidence
    strong_consistency: float = 0.67
    # A claim with a number, or at least this share of words, missing from its supporting
    # passage is a deduction: inferred, not high (see verification/novelty.py).
    novelty_threshold: float = 0.2
    # Chance a claim is supported = sigmoid(slope * score + intercept): Platt scaling of
    # the score, fitted on the dev claims by calibration/evaluate.py (see config.yaml).
    support_slope: float = 6.27
    support_intercept: float = -2.07

    # API
    cors_origins: list[str] = ["http://localhost:3000"]

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        sources = [init_settings, env_settings, dotenv_settings]
        yaml_path = os.environ.get("VERITRACE_CONFIG", str(DEFAULT_CONFIG_YAML))
        if yaml_path:
            sources.append(YamlConfigSettingsSource(settings_cls, yaml_file=yaml_path))
        return (*sources, file_secret_settings)

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
