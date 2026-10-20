"""Client-side rate limiting and retry for hosted LLM APIs.

Free tiers allow only a few requests per minute, and one question makes six or seven
calls. Pacing requests here, rather than sending them and collecting 429 errors, keeps a
question moving: calls wait their turn instead of failing.
"""

import asyncio
import random
import time
from collections import deque
from collections.abc import Awaitable, Callable


class RateLimiter:
    """Allows at most `per_minute` requests in any sliding 60-second window."""

    def __init__(self, per_minute: int, *, clock: Callable[[], float] = time.monotonic):
        self.per_minute = per_minute
        self._clock = clock
        self._sent: deque[float] = deque()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        if self.per_minute <= 0:
            return
        async with self._lock:
            while True:
                now = self._clock()
                while self._sent and now - self._sent[0] >= 60:
                    self._sent.popleft()
                if len(self._sent) < self.per_minute:
                    self._sent.append(now)
                    return
                await asyncio.sleep(60 - (now - self._sent[0]) + 0.05)


class Retryable(Exception):
    """Raised by a call to request another attempt, optionally after a server-given delay."""

    def __init__(self, cause: Exception, delay: float | None = None):
        super().__init__(str(cause))
        self.cause = cause
        self.delay = delay


async def with_retries[T](
    call: Callable[[], Awaitable[T]],
    *,
    attempts: int,
    base_delay: float = 2.0,
    max_delay: float = 30.0,
) -> T:
    """Run `call`, retrying when it raises Retryable, with exponential backoff and jitter.
    After the last attempt the original cause is re-raised."""
    for attempt in range(attempts):
        try:
            return await call()
        except Retryable as retry:
            if attempt == attempts - 1:
                raise retry.cause from None
            backoff = min(max_delay, base_delay * 2**attempt) * (0.8 + 0.4 * random.random())
            await asyncio.sleep(min(max_delay, retry.delay) if retry.delay is not None else backoff)
    raise AssertionError("unreachable")
