"""Picks the LLM provider named by LLM_PROVIDER, wrapped with the fallbacks named by
LLM_FALLBACK (comma-separated, tried in order) whose keys are set."""

from app.config import Settings
from app.providers.base import LLMProvider
from app.providers.fallback import FallbackProvider
from app.providers.gemini import GeminiProvider
from app.providers.openai_compat import OpenAICompatibleProvider


def build_provider(settings: Settings) -> LLMProvider:
    names = [settings.llm_provider]
    for name in settings.llm_fallback.split(","):
        name = name.strip()
        if name and name not in names and _has_key(name, settings):
            names.append(name)
    # groq, groq_backup, gemini -> groq with (groq_backup with gemini) as its fallback
    provider = _single(names.pop(), settings)
    while names:
        provider = FallbackProvider(_single(names.pop(), settings), provider)
    return provider


def _has_key(name: str, settings: Settings) -> bool:
    return bool(getattr(settings, f"{name}_api_key", None))


def _single(name: str, settings: Settings) -> LLMProvider:
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
    if name in ("groq", "groq_backup"):
        key = getattr(settings, f"{name}_api_key")
        if not key:
            raise ValueError(f"LLM_PROVIDER={name} needs {name.upper()}_API_KEY in backend/.env.")
        # groq_backup is a second Groq account: same model and limits, its own quota
        return OpenAICompatibleProvider(
            name=name,
            base_url=settings.groq_base_url,
            api_key=key.get_secret_value(),
            model=settings.groq_model,
            temperature=settings.llm_temperature,
            requests_per_minute=settings.groq_requests_per_minute,
            timeout_s=settings.llm_timeout_s,
            reasoning_effort=settings.groq_reasoning_effort,
        )
    raise ValueError(f"Unknown LLM provider: {name!r}. Use groq, groq_backup or gemini.")
