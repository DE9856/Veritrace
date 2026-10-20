"""The interface every LLM backend implements, so the agent never depends on a vendor SDK."""

from collections.abc import AsyncIterator
from typing import Protocol, TypeVar

from pydantic import BaseModel

from app.schemas import ProviderHealth

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    """Raised when the LLM backend is unreachable or returns an unusable response."""


class LLMProvider(Protocol):
    name: str
    model: str

    async def generate(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> str: ...

    def stream(
        self, prompt: str, *, system: str | None = None, temperature: float | None = None
    ) -> AsyncIterator[str]:
        """Yield the answer as it is generated, in text pieces."""
        ...

    async def generate_json(
        self, prompt: str, schema: type[T], *, system: str | None = None
    ) -> T: ...

    async def sample(
        self, prompt: str, n: int, *, system: str | None = None, temperature: float = 0.8
    ) -> list[str]: ...

    async def health(self) -> ProviderHealth: ...
