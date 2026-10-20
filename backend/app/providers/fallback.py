"""Primary provider with a fallback for when the primary runs out of quota."""

import time
from collections.abc import AsyncIterator, Callable

from app.providers.base import LLMProvider, RateLimitError, T
from app.schemas import ProviderHealth

# How long to skip the primary after a rate limit that came without a reset time. The
# primary has already retried with backoff by then, so the limit is not momentary.
DEFAULT_COOLDOWN_S = 60.0


class FallbackProvider:
    """Sends calls to the primary provider. If the primary is rate limited even after its
    own retries, the call goes to the fallback, and the primary is skipped (a circuit
    breaker) until its limit resets: for a daily quota that is hours, so later calls go
    straight to the fallback instead of failing first.

    Other errors are not hidden: a broken prompt or a bad key should surface, not
    silently switch models."""

    def __init__(
        self,
        primary: LLMProvider,
        fallback: LLMProvider,
        *,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.primary = primary
        self.fallback = fallback
        self.fallback_calls = 0
        self._clock = clock
        self._primary_blocked_until = 0.0

    # The provider and model reported in responses are the ones currently serving.
    @property
    def primary_blocked(self) -> bool:
        return self._clock() < self._primary_blocked_until

    @property
    def name(self) -> str:
        return self.fallback.name if self.primary_blocked else self.primary.name

    @property
    def model(self) -> str:
        return self.fallback.model if self.primary_blocked else self.primary.model

    def _trip(self, error: RateLimitError) -> None:
        cooldown = error.retry_after_s or DEFAULT_COOLDOWN_S
        self._primary_blocked_until = max(self._primary_blocked_until, self._clock() + cooldown)

    async def _call(self, method: str, *args, **kwargs):
        if not self.primary_blocked:
            try:
                return await getattr(self.primary, method)(*args, **kwargs)
            except RateLimitError as error:
                self._trip(error)
        self.fallback_calls += 1
        return await getattr(self.fallback, method)(*args, **kwargs)

    async def generate(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> str:
        return await self._call("generate", prompt, system=system, temperature=temperature)

    async def generate_json(self, prompt: str, schema: type[T], *, system: str | None = None) -> T:
        return await self._call("generate_json", prompt, schema, system=system)

    async def sample(
        self, prompt: str, n: int, *, system: str | None = None, temperature: float = 0.8
    ) -> list[str]:
        return await self._call("sample", prompt, n, system=system, temperature=temperature)

    async def stream(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> AsyncIterator[str]:
        if not self.primary_blocked:
            started = False
            try:
                async for piece in self.primary.stream(
                    prompt, system=system, temperature=temperature
                ):
                    started = True
                    yield piece
                return
            except RateLimitError as error:
                self._trip(error)
                if started:  # half an answer from one model cannot be finished by another
                    raise
        self.fallback_calls += 1
        async for piece in self.fallback.stream(prompt, system=system, temperature=temperature):
            yield piece

    async def health(self) -> ProviderHealth:
        note = f"fallback {self.fallback.name} ({self.fallback.model})"
        if self.fallback_calls:
            note += f", used for {self.fallback_calls} calls since startup"
        if self.primary_blocked:
            hours = (self._primary_blocked_until - self._clock()) / 3600
            resets = f"{hours:.1f} h" if hours >= 1 else f"{hours * 60:.0f} min"
            backup = await self.fallback.health()
            return backup.model_copy(
                update={
                    "detail": f"{self.primary.name} is rate limited (resets in {resets}); "
                    f"serving from the {note}."
                }
            )
        primary = await self.primary.health()
        if primary.reachable and primary.model_available:
            return primary.model_copy(update={"detail": f"With a {note}."})
        backup = await self.fallback.health()
        return backup.model_copy(update={"detail": f"{primary.detail}. Serving from the {note}."})
