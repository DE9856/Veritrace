"""Local models served by Ollama. Used during development (qwen3:4b-instruct)."""

import re
from collections.abc import AsyncIterator

import httpx
import ollama
from pydantic import ValidationError

from app.providers.base import LLMError, T, normalise_output
from app.schemas import ProviderHealth

# We always pass think=False and use a non-thinking model, but strip any stray
# reasoning in case a model ignores the flag. Thinking-only models (e.g. the
# qwen3:4b tag) emit the reasoning with no opening <think>, only a closing one.
_THINK_BLOCK = re.compile(r"^.*?</think>", re.DOTALL)

# The client raises the built-in ConnectionError when the Ollama server is not running.
_OLLAMA_ERRORS = (httpx.HTTPError, ollama.ResponseError, ConnectionError)


class OllamaProvider:
    name = "ollama"

    def __init__(self, host: str, model: str, temperature: float, timeout_s: float):
        self.model = model
        self.temperature = temperature
        self._client = ollama.AsyncClient(host=host, timeout=timeout_s)

    async def _chat(
        self,
        prompt: str,
        *,
        system: str | None,
        temperature: float,
        format: dict | None = None,
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        try:
            response = await self._client.chat(
                model=self.model,
                messages=messages,
                think=False,
                format=format,
                options={"temperature": temperature},
            )
        except _OLLAMA_ERRORS as exc:
            raise LLMError(f"Ollama request failed: {exc}") from exc
        return normalise_output(_THINK_BLOCK.sub("", response.message.content or "")).strip()

    async def generate(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> str:
        t = self.temperature if temperature is None else temperature
        return await self._chat(prompt, system=system, temperature=t)

    async def stream(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> AsyncIterator[str]:
        t = self.temperature if temperature is None else temperature
        messages = [{"role": "system", "content": system}] if system else []
        messages.append({"role": "user", "content": prompt})
        try:
            parts = await self._client.chat(
                model=self.model,
                messages=messages,
                think=False,
                stream=True,
                options={"temperature": t},
            )
            async for part in parts:
                if part.message.content:
                    yield normalise_output(part.message.content)
        except _OLLAMA_ERRORS as exc:
            raise LLMError(f"Ollama request failed: {exc}") from exc

    async def generate_json(self, prompt: str, schema: type[T], *, system: str | None = None) -> T:
        raw = await self._chat(
            prompt, system=system, temperature=0.0, format=schema.model_json_schema()
        )
        try:
            return schema.model_validate_json(raw)
        except ValidationError as exc:
            raise LLMError(f"Model returned JSON that does not match {schema.__name__}") from exc

    async def sample(
        self, prompt: str, n: int, *, system: str | None = None, temperature: float = 0.8
    ) -> list[str]:
        # Sequential on purpose: a single 4 GB GPU gains nothing from parallel requests.
        return [await self._chat(prompt, system=system, temperature=temperature) for _ in range(n)]

    async def health(self) -> ProviderHealth:
        try:
            listing = await self._client.list()
        except _OLLAMA_ERRORS as exc:
            return ProviderHealth(
                provider=self.name,
                model=self.model,
                reachable=False,
                model_available=False,
                detail=f"Cannot reach Ollama: {exc}",
            )
        names = {m.model for m in listing.models}
        available = self.model in names
        return ProviderHealth(
            provider=self.name,
            model=self.model,
            reachable=True,
            model_available=available,
            detail=None if available else f"Run: ollama pull {self.model}",
        )
