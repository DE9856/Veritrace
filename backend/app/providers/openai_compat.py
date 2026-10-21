"""Any OpenAI-compatible chat API: Groq (the fallback), and also Sarvam or OpenRouter.

Talks plain HTTP so no extra SDK is needed."""

import asyncio
import json
import re
from collections.abc import AsyncIterator

import httpx
from pydantic import ValidationError

from app.providers.base import LLMError, RateLimitError, T, normalise_output
from app.providers.limits import RateLimiter, Retryable, with_retries
from app.schemas import ProviderHealth


class OpenAICompatibleProvider:
    def __init__(
        self,
        *,
        name: str,
        base_url: str,
        api_key: str,
        model: str,
        temperature: float,
        requests_per_minute: int,
        max_attempts: int = 3,
        timeout_s: float = 120.0,
        reasoning_effort: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,  # tests pass a mock
    ):
        if not api_key:
            raise ValueError(f"No API key for {name}.")
        self.name = name
        self.model = model
        self.temperature = temperature
        self.max_attempts = max_attempts
        # Reasoning models (gpt-oss) count hidden reasoning against the tokens-per-minute
        # limit; "low" saves quota and time.
        self.reasoning_effort = reasoning_effort
        self.limiter = RateLimiter(requests_per_minute)
        # Tokens the API reports as used (prompt, reasoning and output), for budgeting
        # against a daily token cap (calibration/latency.py reports it per question).
        self.tokens_used = 0
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout_s,
            transport=transport,
        )

    def _body(self, prompt: str, system: str | None, temperature: float, **extra) -> dict:
        messages = [{"role": "system", "content": system}] if system else []
        messages.append({"role": "user", "content": prompt})
        body = {"model": self.model, "messages": messages, "temperature": temperature, **extra}
        if self.reasoning_effort:
            body["reasoning_effort"] = self.reasoning_effort
        return body

    async def _post(self, body: dict) -> dict:
        async def attempt() -> dict:
            await self.limiter.acquire()
            try:
                response = await self._client.post("/chat/completions", json=body)
            except httpx.HTTPError as exc:
                raise Retryable(LLMError(f"{self.name} request failed: {exc}")) from exc
            _raise_for_status(self.name, response)
            data = response.json()
            self.tokens_used += (data.get("usage") or {}).get("total_tokens", 0)
            return data

        return await with_retries(attempt, attempts=self.max_attempts)

    async def generate(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> str:
        t = self.temperature if temperature is None else temperature
        data = await self._post(self._body(prompt, system, t))
        text = normalise_output(data["choices"][0]["message"].get("content") or "").strip()
        if not text:
            raise LLMError(f"{self.name} returned no text.")
        return text

    async def stream(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> AsyncIterator[str]:
        t = self.temperature if temperature is None else temperature
        body = self._body(prompt, system, t, stream=True)

        async def open_stream() -> httpx.Response:
            await self.limiter.acquire()
            try:
                response = await self._client.send(
                    self._client.build_request("POST", "/chat/completions", json=body),
                    stream=True,
                )
            except httpx.HTTPError as exc:
                raise Retryable(LLMError(f"{self.name} request failed: {exc}")) from exc
            if response.status_code >= 400:
                await response.aread()
                await response.aclose()
                _raise_for_status(self.name, response)
            return response

        # Retries cover opening the stream (rate limits, overload); not a broken stream.
        response = await with_retries(open_stream, attempts=self.max_attempts)
        try:
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                payload = line[5:].strip()
                if payload == "[DONE]":
                    break
                chunk = json.loads(payload)
                # Groq reports the stream's usage in its last chunk, under "x_groq".
                usage = chunk.get("usage") or (chunk.get("x_groq") or {}).get("usage") or {}
                self.tokens_used += usage.get("total_tokens", 0)
                choices = chunk.get("choices") or [{}]
                delta = choices[0].get("delta", {}).get("content")
                if delta:
                    yield normalise_output(delta)
        except httpx.HTTPError as exc:
            raise LLMError(f"{self.name} request failed: {exc}") from exc
        finally:
            await response.aclose()

    async def generate_json(self, prompt: str, schema: type[T], *, system: str | None = None) -> T:
        # JSON mode guarantees valid JSON; the schema itself goes in the instructions,
        # because strict schema mode is not available on every model.
        instructions = (
            f"{system or ''}\n\nRespond with a single JSON object that matches this JSON "
            f"schema exactly:\n{json.dumps(schema.model_json_schema())}"
        ).strip()
        data = await self._post(
            self._body(prompt, instructions, 0.0, response_format={"type": "json_object"})
        )
        raw = data["choices"][0]["message"].get("content") or ""
        try:
            return schema.model_validate_json(raw)
        except ValidationError as exc:
            raise LLMError(
                f"{self.name} returned JSON that does not match {schema.__name__}"
            ) from exc

    async def sample(
        self, prompt: str, n: int, *, system: str | None = None, temperature: float = 0.8
    ) -> list[str]:
        return list(
            await asyncio.gather(
                *(self.generate(prompt, system=system, temperature=temperature) for _ in range(n))
            )
        )

    async def health(self) -> ProviderHealth:
        try:
            response = await self._client.get(f"/models/{self.model}")
        except httpx.HTTPError as exc:
            return ProviderHealth(
                provider=self.name,
                model=self.model,
                reachable=False,
                model_available=False,
                detail=f"Cannot reach {self.name}: {exc}",
            )
        ok = response.status_code == 200
        return ProviderHealth(
            provider=self.name,
            model=self.model,
            reachable=response.status_code not in (401, 403),
            model_available=ok,
            detail=None if ok else f"{self.name} answered {response.status_code}",
        )


# The longest server-given wait worth spending inside one call. A longer one, or any
# daily limit, fails over to the fallback at once, and the fallback skips this provider
# until the limit resets: retrying a spent daily quota only wasted about a minute a call.
MAX_RETRY_WAIT_S = 30.0
# Groq: "Please try again in 1m45.408s" (also "12.5s", "500ms", "2h3m").
_TRY_AGAIN = re.compile(r"try again in ((?:\d+(?:\.\d+)?(?:ms|h|m|s))+)")
_UNIT_SECONDS = {"h": 3600.0, "m": 60.0, "s": 1.0, "ms": 0.001}


def retry_wait(response: httpx.Response) -> float | None:
    """Seconds until a rate limit resets: the retry-after header, or the wait the
    message gives."""
    header = response.headers.get("retry-after")
    if header and re.fullmatch(r"\d+(\.\d+)?", header):
        return float(header)
    if match := _TRY_AGAIN.search(response.text):
        parts = re.findall(r"(\d+(?:\.\d+)?)(ms|h|m|s)", match.group(1))
        return sum(float(value) * _UNIT_SECONDS[unit] for value, unit in parts)
    return None


def _raise_for_status(name: str, response: httpx.Response, *, retryable: bool = True) -> None:
    if response.status_code < 400:
        return
    message = f"{name} error {response.status_code}: {response.text[:300]}"
    if response.status_code == 429:
        wait = retry_wait(response)
        error: Exception = RateLimitError(message, retry_after_s=wait)
        daily = re.search(r"per day|\((?:TPD|RPD)\)", response.text, re.IGNORECASE)
        if daily or (wait is not None and wait > MAX_RETRY_WAIT_S):
            raise error
        raise Retryable(error, delay=wait) if retryable else error
    if response.status_code >= 500:
        raise Retryable(LLMError(message)) if retryable else LLMError(message)
    raise LLMError(message)
