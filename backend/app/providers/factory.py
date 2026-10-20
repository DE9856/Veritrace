"""Picks the LLM provider named by LLM_PROVIDER, wrapped with a fallback when one is
configured."""

from app.config import Settings
from app.providers.base import LLMProvider
from app.providers.fallback import FallbackProvider
from app.providers.gemini import GeminiProvider
from app.providers.ollama import OllamaProvider
from app.providers.openai_compat import OpenAICompatibleProvider


def build_provider(settings: Settings) -> LLMProvider:
    primary = _single(settings.llm_provider, settings)
    fallback = settings.llm_fallback
    if fallback and fallback != settings.llm_provider and _has_key(fallback, settings):
        return FallbackProvider(primary, _single(fallback, settings))
    return primary


def _has_key(name: str, settings: Settings) -> bool:
    return name == "ollama" or bool(getattr(settings, f"{name}_api_key", None))


def _single(name: str, settings: Settings) -> LLMProvider:
    if name == "ollama":
        return OllamaProvider(
            host=settings.ollama_host,
            model=settings.ollama_model,
            temperature=settings.llm_temperature,
            timeout_s=settings.llm_timeout_s,
        )
    if name == "gemini":
        if not settings.gemini_api_key:
            raise ValueError("LLM_PROVIDER=gemini needs GEMINI_API_KEY in backend/.env.")
        return GeminiProvider(
            api_key=settings.gemini_api_key.get_secret_value(),
            model=settings.gemini_model,
            temperature=settings.llm_temperature,
            requests_per_minute=settings.gemini_requests_per_minute,
            thinking_budget=settings.gemini_thinking_budget,
            timeout_s=settings.llm_timeout_s,
        )
    if name == "groq":
        if not settings.groq_api_key:
            raise ValueError("LLM_PROVIDER=groq needs GROQ_API_KEY in backend/.env.")
        return OpenAICompatibleProvider(
            name="groq",
            base_url=settings.groq_base_url,
            api_key=settings.groq_api_key.get_secret_value(),
            model=settings.groq_model,
            temperature=settings.llm_temperature,
            requests_per_minute=settings.groq_requests_per_minute,
            timeout_s=settings.llm_timeout_s,
            reasoning_effort=settings.groq_reasoning_effort,
        )
    raise ValueError(f"Unknown LLM provider: {name!r}. Use ollama, gemini or groq.")
