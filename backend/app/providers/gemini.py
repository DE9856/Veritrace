"""Google Gemini through the google-genai SDK. Used for the final version (free tier)."""

import asyncio
import re
import time
from collections.abc import AsyncIterator

import httpx
from google import genai
from google.genai import errors, types
from pydantic import ValidationError

from app.providers.base import LLMError, RateLimitError, T, normalise_output
from app.providers.limits import RateLimiter, Retryable, with_retries
from app.schemas import ProviderHealth

HEALTH_CACHE_S = 300  # the frontend polls health; do not spend quota on it every time


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str,
        temperature: float,
        *,
        requests_per_minute: int,
        max_attempts: int = 4,
        thinking_budget: int | None = 0,
        timeout_s: float = 120.0,
    ):
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set. Add it to backend/.env.")
        self.model = model
        self.temperature = temperature
        self.max_attempts = max_attempts
        self.thinking_budget = thinking_budget
        self.limiter = RateLimiter(requests_per_minute)
        self._client = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout_s * 1000))
        )
        self._health: tuple[float, ProviderHealth] | None = None

    # ------------------------------------------------------------------ requests

    def _config(
        self, system: str | None, temperature: float, schema: dict | None = None
    ) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            # Thinking adds latency and spends quota; the pipeline does its own checking.
            thinking_config=(
                types.ThinkingConfig(thinking_budget=self.thinking_budget)
                if self.thinking_budget is not None
                else None
            ),
            response_mime_type="application/json" if schema else None,
            response_json_schema=schema,
        )

    async def _request(self, prompt: str, config: types.GenerateContentConfig) -> str:
        async def attempt() -> str:
            await self.limiter.acquire()
            try:
                response = await self._client.aio.models.generate_content(
                    model=self.model, contents=prompt, config=config
                )
            except errors.APIError as exc:
                raise _classify(exc) from exc
            except httpx.HTTPError as exc:
                raise Retryable(LLMError(f"Gemini request failed: {exc}")) from exc
            if not response.text:
                reason = _finish_reason(response)
                raise LLMError(f"Gemini returned no text ({reason}).")
            return normalise_output(response.text)

        return await with_retries(attempt, attempts=self.max_attempts)

    async def generate(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> str:
        t = self.temperature if temperature is None else temperature
        return (await self._request(prompt, self._config(system, t))).strip()

    async def stream(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> AsyncIterator[str]:
        t = self.temperature if temperature is None else temperature
        config = self._config(system, t)

        async def open_stream():
            await self.limiter.acquire()
            try:
                return await self._client.aio.models.generate_content_stream(
                    model=self.model, contents=prompt, config=config
                )
            except errors.APIError as exc:
                raise _classify(exc) from exc

        # Retries cover opening the stream; a failure halfway through is reported as is.
        chunks = await with_retries(open_stream, attempts=self.max_attempts)
        try:
            async for chunk in chunks:
                if chunk.text:
                    yield normalise_output(chunk.text)
        except errors.APIError as exc:
            classified = _classify(exc)
            raise (classified.cause if isinstance(classified, Retryable) else classified) from exc

    async def generate_json(self, prompt: str, schema: type[T], *, system: str | None = None) -> T:
        raw = await self._request(
            prompt, self._config(system, 0.0, schema=schema.model_json_schema())
        )
        try:
            return schema.model_validate_json(raw)
        except ValidationError as exc:
            raise LLMError(f"Gemini returned JSON that does not match {schema.__name__}") from exc

    async def sample(
        self, prompt: str, n: int, *, system: str | None = None, temperature: float = 0.8
    ) -> list[str]:
        # A hosted API serves requests in parallel; the rate limiter still paces them.
        return list(
            await asyncio.gather(
                *(self.generate(prompt, system=system, temperature=temperature) for _ in range(n))
            )
        )

    async def health(self) -> ProviderHealth:
        if self._health and time.monotonic() - self._health[0] < HEALTH_CACHE_S:
            return self._health[1]
        try:
            await self._client.aio.models.get(model=self.model)
            health = ProviderHealth(
                provider=self.name, model=self.model, reachable=True, model_available=True
            )
        except errors.APIError as exc:
            health = ProviderHealth(
                provider=self.name,
                model=self.model,
                reachable=exc.code not in (401, 403),
                model_available=False,
                detail=f"Gemini: {exc.message or exc.status} ({exc.code})",
            )
        except httpx.HTTPError as exc:
            health = ProviderHealth(
                provider=self.name,
                model=self.model,
                reachable=False,
                model_available=False,
                detail=f"Cannot reach Gemini: {exc}",
            )
        self._health = (time.monotonic(), health)
        return health


def _classify(exc: errors.APIError) -> Exception:
    """Map an API error to a retry (rate limit, overload) or a final LLMError."""
    message = f"Gemini error {exc.code}: {exc.message or exc.status}"
    if exc.code == 429:
        text = str(exc)
        # A daily quota will not recover by waiting a few seconds: fail over at once.
        if re.search(r"PerDay|per day|daily", text, re.IGNORECASE):
            return RateLimitError(
                f"Gemini daily quota reached. {message}", retry_after_s=_retry_delay(text)
            )
        return Retryable(RateLimitError(message), delay=_retry_delay(text))
    if exc.code in (500, 502, 503, 504):
        return Retryable(LLMError(message))
    return LLMError(message)


def _retry_delay(text: str) -> float | None:
    """The server's suggested wait, e.g. "retryDelay": "17s"."""
    match = re.search(r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s", text)
    return float(match.group(1)) + 0.5 if match else None


def _finish_reason(response: types.GenerateContentResponse) -> str:
    try:
        return str(response.candidates[0].finish_reason)
    except (AttributeError, IndexError, TypeError):
        feedback = getattr(response, "prompt_feedback", None)
        return f"prompt blocked: {feedback}" if feedback else "unknown reason"
