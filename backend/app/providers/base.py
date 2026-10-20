"""The interface every LLM backend implements, so the agent never depends on a vendor SDK."""

import re
from collections.abc import AsyncIterator
from typing import Protocol, TypeVar

from pydantic import BaseModel

from app.schemas import ProviderHealth

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    """Raised when the LLM backend is unreachable or returns an unusable response."""


class RateLimitError(LLMError):
    """The provider refused the request because a quota or rate limit was reached, even
    after waiting and retrying. A fallback provider can take over.

    `retry_after_s` is set when the provider says how long the limit lasts, as with a
    daily quota; a fallback can then skip the provider until it resets."""

    def __init__(self, message: str, retry_after_s: float | None = None):
        super().__init__(message)
        self.retry_after_s = retry_after_s


# Models format citations, spaces and hyphens differently: gpt-oss writes 【S1】, puts
# narrow no-break spaces in dates and non-breaking hyphens in names. The pipeline expects
# [S1], plain spaces and plain hyphens.
_NORMALISE = str.maketrans(
    {
        "【": "[",
        "】": "]",
        "［": "[",
        "］": "]",
        "\u202f": " ",  # narrow no-break space
        "\u00a0": " ",  # no-break space
        "\u2009": " ",  # thin space
        "\u2011": "-",  # non-breaking hyphen: "Chandrayaan‑3"
        "\u2010": "-",  # hyphen
    }
)


# Some models pad citations: "[ S2 ]" or "[S2 , S3]".
_PADDED_CITATION = re.compile(r"\[\s*(S\d+(?:\s*[,;]\s*S\d+)*)\s*\]")


def normalise_output(text: str) -> str:
    return _PADDED_CITATION.sub(r"[\1]", text.translate(_NORMALISE))


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
