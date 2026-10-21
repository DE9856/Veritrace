"""Gemini, Groq and the fallback, tested offline with fake clocks, SDK errors and mock HTTP."""

import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors
from pydantic import BaseModel

from app.config import Settings
from app.providers import limits
from app.providers.base import LLMError, RateLimitError
from app.providers.factory import build_provider
from app.providers.fallback import FallbackProvider
from app.providers.gemini import GeminiProvider, _classify
from app.providers.limits import RateLimiter, Retryable, with_retries
from app.providers.openai_compat import OpenAICompatibleProvider


@pytest.fixture
def no_sleep(monkeypatch):
    """Record sleeps instead of waiting."""
    slept: list[float] = []

    async def fake_sleep(seconds):
        slept.append(seconds)

    monkeypatch.setattr(limits.asyncio, "sleep", fake_sleep)
    return slept


# ---------------------------------------------------------------- rate limiting and retries


async def test_rate_limiter_waits_for_the_oldest_request_to_leave_the_window(monkeypatch):
    now = [0.0]

    async def advance(seconds):
        now[0] += seconds

    monkeypatch.setattr(limits.asyncio, "sleep", advance)
    limiter = RateLimiter(2, clock=lambda: now[0])
    await limiter.acquire()
    now[0] = 10.0
    await limiter.acquire()
    await limiter.acquire()  # third in a minute: waits until the first is 60 s old
    assert now[0] == pytest.approx(60.05)


async def test_retries_use_the_server_delay_then_give_up(no_sleep):
    calls = 0

    async def always_limited():
        nonlocal calls
        calls += 1
        raise Retryable(RateLimitError("429"), delay=7.0)

    with pytest.raises(RateLimitError):
        await with_retries(always_limited, attempts=3)
    assert calls == 3
    assert no_sleep == [7.0, 7.0]


async def test_retries_succeed_after_a_transient_error(no_sleep):
    results = iter([Retryable(LLMError("503")), "ok"])

    async def flaky():
        result = next(results)
        if isinstance(result, Exception):
            raise result
        return result

    assert await with_retries(flaky, attempts=3) == "ok"
    assert len(no_sleep) == 1


# ---------------------------------------------------------------- Gemini


def api_error(code: int, message: str, details: list | None = None) -> errors.APIError:
    status = {429: "RESOURCE_EXHAUSTED", 503: "UNAVAILABLE", 400: "INVALID_ARGUMENT"}[code]
    body = {"error": {"code": code, "message": message, "status": status, "details": details or []}}
    return errors.ClientError(code, body) if code < 500 else errors.ServerError(code, body)


def test_per_minute_limit_is_retried_after_the_suggested_delay():
    retry = _classify(
        api_error(429, "Quota exceeded", [{"@type": "RetryInfo", "retryDelay": "17s"}])
    )
    assert isinstance(retry, Retryable) and isinstance(retry.cause, RateLimitError)
    assert retry.delay == 17.5


def test_daily_quota_fails_over_immediately():
    error = _classify(
        api_error(
            429, "Quota exceeded for metric generate_content_free_tier_requests, limit: PerDay"
        )
    )
    assert isinstance(error, RateLimitError)


def test_overload_is_retried_and_bad_requests_are_not():
    assert isinstance(_classify(api_error(503, "overloaded")), Retryable)
    assert type(_classify(api_error(400, "bad schema"))) is LLMError


class Plan(BaseModel):
    queries: list[str]


def gemini(responses: list) -> GeminiProvider:
    provider = GeminiProvider(
        api_key="test", model="gemini-test", temperature=0.2, requests_per_minute=0
    )
    calls = iter(responses)

    async def generate_content(*, model, contents, config):
        result = next(calls)
        if isinstance(result, Exception):
            raise result
        return SimpleNamespace(text=result, candidates=[])

    provider._client = SimpleNamespace(
        aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    )
    return provider


async def test_gemini_retries_a_rate_limit_then_answers(no_sleep):
    provider = gemini([api_error(429, "slow down"), "An answer [S1]."])
    assert await provider.generate("q") == "An answer [S1]."
    assert len(no_sleep) == 1


async def test_gemini_reports_rate_limit_after_its_attempts(no_sleep):
    provider = gemini([api_error(429, "slow down")] * 4)
    with pytest.raises(RateLimitError):
        await provider.generate("q")


async def test_gemini_parses_structured_output():
    provider = gemini(['{"queries": ["a", "b"]}'])
    assert (await provider.generate_json("q", Plan)).queries == ["a", "b"]


async def test_gemini_samples_in_parallel():
    provider = gemini(["one", "two", "three"])
    assert sorted(await provider.sample("q", 3)) == ["one", "three", "two"]


# ---------------------------------------------------------------- Groq (OpenAI-compatible)


def groq(handler) -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(
        name="groq",
        base_url="https://api.test/v1",
        api_key="test",
        model="llama-test",
        temperature=0.2,
        requests_per_minute=0,
        transport=httpx.MockTransport(handler),
    )


def completion(text: str) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})


async def test_groq_generates_and_sends_the_system_prompt():
    seen = {}

    def handler(request: httpx.Request):
        seen.update(json.loads(request.content))
        return completion("Hello [S1].")

    assert await groq(handler).generate("q", system="be strict") == "Hello [S1]."
    assert seen["messages"][0] == {"role": "system", "content": "be strict"}


async def test_groq_json_mode_includes_the_schema():
    seen = {}

    def handler(request: httpx.Request):
        seen.update(json.loads(request.content))
        return completion('{"queries": ["x"]}')

    assert (await groq(handler).generate_json("q", Plan)).queries == ["x"]
    assert seen["response_format"] == {"type": "json_object"}
    assert '"queries"' in seen["messages"][0]["content"]


async def test_groq_honours_retry_after(no_sleep):
    responses = iter(
        [httpx.Response(429, headers={"retry-after": "3"}, text="limit"), completion("ok")]
    )
    assert await groq(lambda r: next(responses)).generate("q") == "ok"
    assert no_sleep == [3.0]


TPD_LIMIT = (
    '{"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` on tokens per '
    "day (TPD): Limit 200000, Used 199716, Requested 528. Please try again in 1m45.408s."
    '","type":"tokens","code":"rate_limit_exceeded"}}'
)


async def test_groq_daily_limit_fails_over_at_once_with_the_reset_time(no_sleep):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(429, text=TPD_LIMIT)

    with pytest.raises(RateLimitError) as raised:
        await groq(handler).generate("q")
    assert len(calls) == 1 and no_sleep == []  # no retries spent on a daily quota
    assert raised.value.retry_after_s == pytest.approx(105.408)


async def test_groq_long_wait_is_not_spent_inside_the_call(no_sleep):
    responses = iter([httpx.Response(429, text="Please try again in 2m3s.")])
    with pytest.raises(RateLimitError) as raised:
        await groq(lambda r: next(responses)).generate("q")
    assert raised.value.retry_after_s == 123 and no_sleep == []


async def test_fallback_skips_groq_until_its_daily_limit_resets(no_sleep):
    groq_calls = []

    def handler(request):
        groq_calls.append(request)
        return httpx.Response(429, text=TPD_LIMIT)

    clock = Clock()
    backup = SimpleNamespace(name="backup", model="m")

    async def answer(*args, **kwargs):
        return "from backup"

    backup.generate = answer
    provider = FallbackProvider(groq(handler), backup, clock=clock)
    assert await provider.generate("q") == "from backup"
    assert await provider.generate("q") == "from backup"
    assert len(groq_calls) == 1  # the second call goes straight to the backup
    clock.now += 106
    assert await provider.generate("q") == "from backup"
    assert len(groq_calls) == 2  # tried again once the limit should have reset


async def test_groq_streams_server_sent_events():
    body = (
        'data: {"choices": [{"delta": {"content": "Hel"}}]}\n\n'
        'data: {"choices": [{"delta": {"content": "lo"}}]}\n\n'
        "data: [DONE]\n\n"
    )
    provider = groq(
        lambda r: httpx.Response(200, text=body, headers={"content-type": "text/event-stream"})
    )
    assert [piece async for piece in provider.stream("q")] == ["Hel", "lo"]


async def test_groq_counts_the_tokens_it_reports():
    body = (
        'data: {"choices": [{"delta": {"content": "Hi"}}]}\n\n'
        'data: {"choices": [], "x_groq": {"usage": {"total_tokens": 40}}}\n\n'
        "data: [DONE]\n\n"
    )

    def handler(request: httpx.Request):
        if json.loads(request.content).get("stream"):
            return httpx.Response(200, text=body, headers={"content-type": "text/event-stream"})
        message = {"choices": [{"message": {"content": "ok"}}], "usage": {"total_tokens": 2}}
        return httpx.Response(200, json=message)

    provider = groq(handler)
    assert [piece async for piece in provider.stream("q")] == ["Hi"]
    await provider.generate("q")
    assert provider.tokens_used == 42


# ---------------------------------------------------------------- fallback and factory


class Scripted:
    def __init__(self, name, error=None):
        self.name, self.model, self.error, self.calls = name, f"{name}-model", error, 0

    async def generate(self, prompt, *, system=None, temperature=None):
        self.calls += 1
        if self.error:
            raise self.error
        return f"from {self.name}"

    async def stream(self, prompt, *, system=None, temperature=None):
        yield "partial"
        if self.error:
            raise self.error


async def test_fallback_takes_over_only_on_rate_limits():
    limited = FallbackProvider(Scripted("gemini", RateLimitError("429")), Scripted("groq"))
    assert await limited.generate("q") == "from groq"
    assert limited.fallback_calls == 1

    broken = FallbackProvider(Scripted("gemini", LLMError("bad key")), Scripted("groq"))
    with pytest.raises(LLMError, match="bad key"):
        await broken.generate("q")


async def test_fallback_does_not_splice_a_half_streamed_answer():
    provider = FallbackProvider(Scripted("gemini", RateLimitError("429")), Scripted("groq"))
    with pytest.raises(RateLimitError):
        async for _ in provider.stream("q"):
            pass


def test_factory_wraps_gemini_with_groq_when_both_keys_are_set():
    settings = Settings(
        _env_file=None, llm_provider="gemini", gemini_api_key="g-key", groq_api_key="q-key"
    )
    provider = build_provider(settings)
    assert isinstance(provider, FallbackProvider)
    assert (provider.primary.name, provider.fallback.name) == ("gemini", "groq")


def test_factory_without_a_fallback_key_returns_gemini_alone():
    provider = build_provider(Settings(_env_file=None, llm_provider="gemini", gemini_api_key="g"))
    assert isinstance(provider, GeminiProvider)


def test_missing_gemini_key_is_a_clear_error():
    with pytest.raises(ValueError, match="GEMINI_API_KEY"):
        build_provider(Settings(_env_file=None, llm_provider="gemini"))


def test_api_keys_never_appear_in_settings_output():
    settings = Settings(_env_file=None, gemini_api_key="secret-123", groq_api_key="secret-456")
    assert "secret-123" not in repr(settings) and "secret-456" not in str(settings)


def test_asyncio_is_used_for_waiting():
    # with_retries and RateLimiter must look up asyncio.sleep at call time, so the
    # no_sleep fixture can replace it.
    assert limits.asyncio is asyncio


def test_empty_keys_from_the_example_env_file_mean_no_fallback():
    settings = Settings(_env_file=None, llm_provider="ollama", groq_api_key="")
    assert type(build_provider(settings)).__name__ == "OllamaProvider"


# ---------------------------------------------------------------- circuit breaker


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


async def test_daily_quota_trips_the_breaker_until_the_reset():
    clock = Clock()
    gemini = Scripted("gemini", RateLimitError("daily quota", retry_after_s=3600))
    provider = FallbackProvider(gemini, Scripted("groq"), clock=clock)

    assert await provider.generate("q") == "from groq"
    assert (provider.name, provider.model) == ("groq", "groq-model")
    assert await provider.generate("q") == "from groq"
    assert gemini.calls == 1  # skipped while the breaker is open

    clock.now += 3601  # quota has reset
    gemini.error = None
    assert await provider.generate("q") == "from gemini"
    assert provider.name == "gemini"


async def test_rate_limit_without_reset_time_skips_the_primary_briefly():
    clock = Clock()
    gemini = Scripted("gemini", RateLimitError("per minute"))
    provider = FallbackProvider(gemini, Scripted("groq"), clock=clock)
    await provider.generate("q")
    clock.now += 61
    gemini.error = None
    assert await provider.generate("q") == "from gemini"


async def test_waits_for_a_per_minute_limit_when_the_fallback_is_out_of_quota():
    clock = Clock()
    groq = Scripted("groq", RateLimitError("tokens per minute", retry_after_s=40))
    gemini = Scripted("gemini", RateLimitError("daily quota", retry_after_s=5000))
    waits = []

    async def sleep(seconds):
        waits.append(seconds)
        clock.now += seconds
        groq.error = None  # the per-minute window has passed

    provider = FallbackProvider(groq, gemini, clock=clock, sleep=sleep)
    assert await provider.generate("q") == "from groq"
    assert waits == [40]
    assert provider.name == "groq"


async def test_does_not_wait_for_a_primary_daily_quota():
    clock = Clock()
    gemini = Scripted("gemini", RateLimitError("daily quota", retry_after_s=5000))
    groq = Scripted("groq", RateLimitError("tokens per minute"))

    async def sleep(seconds):
        raise AssertionError("should not wait hours")

    provider = FallbackProvider(gemini, groq, clock=clock, sleep=sleep)
    with pytest.raises(RateLimitError, match="tokens per minute"):
        await provider.generate("q")


def test_gemini_daily_quota_error_carries_the_reset_time():
    error = _classify(
        api_error(
            429,
            "Quota exceeded, quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier",
            [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "53937s"}],
        )
    )
    assert isinstance(error, RateLimitError)
    assert error.retry_after_s == pytest.approx(53937.5)


def test_citations_and_spaces_are_normalised():
    from app.providers.base import normalise_output

    assert normalise_output("Chandrayaan\u20113 on 23\u202fAugust\u202f2023【S1】.") == (
        "Chandrayaan-3 on 23 August 2023[S1]."
    )


async def test_groq_stream_retries_a_rate_limited_open(no_sleep):
    body = 'data: {"choices": [{"delta": {"content": "ok"}}]}\n\ndata: [DONE]\n\n'
    responses = iter(
        [
            httpx.Response(429, headers={"retry-after": "4"}, text="tokens per minute"),
            httpx.Response(200, text=body, headers={"content-type": "text/event-stream"}),
        ]
    )
    provider = groq(lambda r: next(responses))
    assert [piece async for piece in provider.stream("q")] == ["ok"]
    assert no_sleep == [4.0]


async def test_groq_sends_reasoning_effort_when_set():
    seen = {}

    def handler(request: httpx.Request):
        seen.update(json.loads(request.content))
        return completion("ok")

    provider = groq(handler)
    provider.reasoning_effort = "low"
    await provider.generate("q")
    assert seen["reasoning_effort"] == "low"


def test_padded_citations_are_normalised():
    from app.agent.nodes.generate import extract_citations
    from app.providers.base import normalise_output

    text = normalise_output("on 23 August [ S2 ]. Also [S1 , S3].")
    assert extract_citations(text, {"S1", "S2", "S3"}) == (["S2", "S1", "S3"], [])


def test_connective_words_do_not_count_as_new_content():
    from app.verification.novelty import novelty

    passage = "The Laser Induced Breakdown Spectroscope (LIBS) on the rover detected iron."
    n = novelty("The rover, using its LIBS, also detected iron.", passage)
    assert n.new_words == []
