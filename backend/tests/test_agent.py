"""The agent graph: retrieval retry loop, routing, safe-mode revision and streaming."""

import json

from tests.test_api import ask, upload

INVENTED = {
    "sentences": [
        {"index": 0, "claims": ["Vikram landed on 23 August 2023."]},
        {"index": 1, "claims": ["Pragyan detected water ice."]},
    ]
}


def test_empty_knowledge_base_takes_the_no_sources_route(client):
    body = ask(client)
    assert body["trace"] == ["analyze", "retrieve", "no_sources"]
    assert body["retrieval_attempts"] == 1


def test_weak_evidence_triggers_query_rewrites_then_answers_with_low_coverage(client, provider):
    upload(client)
    body = ask(client, "zebra quantum marmalade")
    assert body["retrieval_attempts"] == 3  # first search plus two retries
    assert body["trace"][:6] == ["analyze", "retrieve"] * 3
    assert body["low_coverage"] is True
    assert provider.plans_requested == 3
    assert body["answer"]  # it still answers, with the coverage warning


def test_rewritten_query_recovers_strong_evidence(client, provider):
    upload(client)
    client.app.state.agent.settings.evidence_threshold = 0.3
    provider.planned = [[], ["The Vikram lander touched down near the lunar south pole"]]
    body = ask(client, "zebra quantum marmalade")
    assert body["retrieval_attempts"] == 2
    assert body["low_coverage"] is False
    assert "The Vikram lander touched down near the lunar south pole" in body["queries"]
    assert "23 August 2023" in body["sources"][0]["text"]


def test_safe_mode_revises_an_answer_with_flagged_claims(client, provider):
    upload(client)
    provider.reply = "Vikram landed on 23 August 2023 [S1]. Pragyan detected water ice [S1]."
    provider.extraction = INVENTED
    body = client.post("/api/chat", json={"question": "What happened?", "safe_mode": True}).json()
    assert body["counts"]["hallucinated"] == 1
    assert body["trace"][-1] == "revise"
    assert body["revised_answer"] == provider.revision
    # The prompt lists the flagged claim for removal.
    assert "[hallucinated] Pragyan detected water ice." in provider.prompts[-1]


def test_safe_mode_skips_revision_when_nothing_is_flagged(client):
    upload(client)
    body = client.post(
        "/api/chat", json={"question": "When did Vikram land?", "safe_mode": True}
    ).json()
    assert body["trace"][-1] == "score"
    assert body["revised_answer"] is None


def test_without_safe_mode_flagged_answers_are_not_revised(client, provider):
    upload(client)
    provider.reply = "Vikram landed on 23 August 2023 [S1]. Pragyan detected water ice [S1]."
    provider.extraction = INVENTED
    body = ask(client)
    assert body["counts"]["hallucinated"] == 1
    assert body["revised_answer"] is None


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.replace("\r\n", "\n").strip().split("\n\n"):
        fields = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        events.append((fields["event"], json.loads(fields["data"])))
    return events


def test_stream_reports_each_step_then_the_verdict(client):
    upload(client)
    r = client.post("/api/chat/stream", json={"question": "When did the Vikram lander land?"})
    assert r.status_code == 200
    events = parse_sse(r.text)
    kinds = [kind for kind, _ in events]

    statuses = [data["node"] for kind, data in events if kind == "status"]
    assert statuses[:3] == ["analyze", "retrieve", "generate"]
    assert "draft" in kinds
    assert kinds.index("draft") > kinds.index("status")
    assert kinds[-1] == "verdict"
    verdict = events[-1][1]
    assert verdict["answer"] == "Vikram landed on 23 August 2023. [S1]"
    assert (
        verdict["sentences"][0]["label"] is not None
    )  # labelled; the label itself is tested elsewhere


def test_stream_reports_llm_failure_as_an_error_event(client, provider):
    upload(client)

    async def broken(*args, **kwargs):
        from app.providers.base import LLMError

        raise LLMError("Ollama request failed: connection refused")
        yield  # makes this an async generator

    provider.stream = broken
    events = parse_sse(client.post("/api/chat/stream", json={"question": "q"}).text)
    assert events[-1] == ("error", {"message": "Ollama request failed: connection refused"})


def test_graph_endpoint_returns_the_compiled_graph(client):
    mermaid = client.get("/api/chat/graph").json()["mermaid"]
    for edge in (
        "retrieve -. &nbsp;retry&nbsp; .-> analyze",  # the retrieval loop
        "verify --> judge",  # parallel branches
        "verify --> consistency",
        "judge --> score",
        "score -.-> revise",  # safe mode
    ):
        assert edge in mermaid


def test_check_mode_verifies_the_given_answer_instead_of_writing_one(client, provider):
    upload(client)
    provider.extraction = {
        "sentences": [
            {"index": 0, "claims": ["Vikram touched down on 23 August 2023."]},
            {"index": 1, "claims": ["Pragyan detected water ice."]},
        ]
    }

    async def no_writing(*args, **kwargs):
        raise AssertionError("check mode must not write an answer")
        yield  # makes this an async generator

    provider.stream = no_writing
    r = client.post(
        "/api/chat/stream",
        json={
            "question": "When did the Vikram lander land?",
            "answer": "Vikram touched down on 23 August 2023 [S1]. Pragyan detected water ice.",
        },
    )
    events = parse_sse(r.text)
    status = next(d for k, d in events if k == "status" and d["node"] == "generate")
    assert status["message"] == "Reading the answer to check"
    verdict = events[-1][1]
    assert (
        verdict["answer"]
        == "Vikram touched down on 23 August 2023 [S1]. Pragyan detected water ice."
    )
    assert verdict["cited_labels"] == ["S1"]
    assert [s["label"] for s in verdict["sentences"]] == ["high", "hallucinated"]
