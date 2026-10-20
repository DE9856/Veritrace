import pytest

from app.providers.base import LLMError
from app.providers.ollama import OllamaProvider


@pytest.fixture
def offline() -> OllamaProvider:
    # Nothing listens on port 9, so this behaves like a stopped Ollama server.
    return OllamaProvider(
        host="http://127.0.0.1:9", model="qwen3:4b-instruct", temperature=0.2, timeout_s=2
    )


async def test_generate_raises_llm_error_when_ollama_is_down(offline):
    with pytest.raises(LLMError):
        await offline.generate("hello")


async def test_health_reports_unreachable_instead_of_crashing(offline):
    health = await offline.health()
    assert health.reachable is False
    assert health.model_available is False
