"""Picks the LLM provider named by the LLM_PROVIDER setting."""

from app.config import Settings
from app.providers.base import LLMProvider
from app.providers.ollama import OllamaProvider


def build_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "ollama":
        return OllamaProvider(
            host=settings.ollama_host,
            model=settings.ollama_model,
            temperature=settings.llm_temperature,
            timeout_s=settings.llm_timeout_s,
        )
    # Gemini and the Sarvam/Groq fallback are added in Phase 6.
    raise ValueError(f"Unknown LLM_PROVIDER: {settings.llm_provider!r}")
