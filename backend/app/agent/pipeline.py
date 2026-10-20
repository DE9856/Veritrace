"""Question pipeline:
retrieve -> generate -> (extract claims | resample answers) -> verify against sources
-> consistency against samples -> judge unconfirmed claims -> score.

This is a plain sequential runner. In Phase 4 the same nodes are wired into a
LangGraph StateGraph (graph.py) with the retry loop and the remaining checks.
"""

import asyncio
import time
from collections.abc import Awaitable

from app.agent.nodes.consistency import consistency_scores, sample_answers
from app.agent.nodes.extract import extract_claims, split_answer
from app.agent.nodes.generate import generate
from app.agent.nodes.judge import judge_claims
from app.agent.nodes.retrieve import retrieve
from app.agent.nodes.verify import verify
from app.providers.base import LLMError
from app.schemas import ChatRequest, ChatResponse, LabelCounts, SourceChunk
from app.services import Services
from app.verification.scoring import build_sentence, needs_judgement, roll_up, score_claim

EMPTY_KB_ANSWER = "The knowledge base is empty. Upload a document first, then ask again."
NO_MATCH_ANSWER = "No passages were found in the selected documents."


async def answer_question(request: ChatRequest, services: Services) -> ChatResponse:
    settings = services.settings
    provider = services.provider
    timings: dict[str, int] = {}

    start = time.perf_counter()
    sources = await retrieve(
        request.question,
        embedder=services.embedder,
        store=services.store,
        k=request.top_k or settings.top_k,
        document_ids=request.document_ids,
    )
    timings["retrieve"] = _ms_since(start)

    if not sources:
        return ChatResponse(
            answer=EMPTY_KB_ANSWER if services.store.count() == 0 else NO_MATCH_ANSWER,
            answer_confidence=None,
            counts=LabelCounts(),
            sentences=[],
            extraction_fallback=False,
            cited_labels=[],
            invalid_citations=[],
            sources=[],
            provider=provider.name,
            model=provider.model,
            timings_ms=timings,
        )

    start = time.perf_counter()
    generated = await generate(request.question, sources, provider=provider)
    timings["generate"] = _ms_since(start)

    answer_sentences = split_answer(generated.tagged)
    labels = {s.index: s.self_label for s in answer_sentences}

    # LLM calls (GPU) and NLI (CPU) overlap wherever the data allows:
    #   GPU: extract claims -> resample answers ------------> judge
    #   CPU:                   verify claims against sources -> consistency against samples
    # Extraction is created first so its request reaches Ollama before the samples.
    extraction = asyncio.create_task(
        _timed(
            timings,
            "extract",
            extract_claims(request.question, answer_sentences, provider=provider),
        )
    )
    sampling = asyncio.create_task(
        _timed(timings, "sample", _safe_samples(request.question, sources, services))
    )
    judging: asyncio.Task | None = None
    try:
        claims, used_fallback = await extraction
        evidence = await _timed(
            timings,
            "verify",
            verify(
                claims,
                answer_sentences,
                sources,
                embedder=services.embedder,
                nli=services.nli,
                window_size=settings.nli_window_sentences,
                per_claim=settings.nli_windows_per_claim,
            ),
        )
        for ev in evidence:
            ev.self_label = labels.get(ev.sentence_index)

        # Judge only the claims NLI could not confirm, in one LLM call.
        if settings.judge_enabled:
            to_judge = {
                i: ev.text for i, ev in enumerate(evidence) if needs_judgement(ev, settings)
            }
            judging = asyncio.create_task(
                _timed(timings, "judge", judge_claims(to_judge, sources, provider=provider))
            )

        samples = await sampling
        consistency = await _timed(
            timings, "consistency", consistency_scores(claims, samples, nli=services.nli)
        )
        for ev, cons in zip(evidence, consistency, strict=True):
            ev.consistency = cons

        if judging:
            for i, judgement in (await judging).items():
                evidence[i].judge = judgement.verdict
                evidence[i].judge_reason = judgement.reason
    finally:
        for task in (extraction, sampling, judging):
            if task and not task.done():
                task.cancel()

    claims_by_sentence: dict[int, list] = {s.index: [] for s in answer_sentences}
    for ev in evidence:
        claims_by_sentence[ev.sentence_index].append(score_claim(ev, settings))
    sentences = [
        build_sentence(s.index, s.text, claims_by_sentence[s.index]) for s in answer_sentences
    ]
    confidence, counts = roll_up(sentences)

    return ChatResponse(
        answer=generated.answer,
        answer_confidence=confidence,
        counts=counts,
        sentences=sentences,
        extraction_fallback=used_fallback,
        cited_labels=generated.cited_labels,
        invalid_citations=generated.invalid_citations,
        sources=sources,
        provider=provider.name,
        model=provider.model,
        timings_ms=timings,
    )


async def _safe_samples(question: str, sources: list[SourceChunk], services: Services) -> list[str]:
    """Resampled answers, or none if sampling fails: consistency is then left out."""
    try:
        return await sample_answers(
            question,
            sources,
            provider=services.provider,
            n=services.settings.consistency_samples,
            temperature=services.settings.sample_temperature,
        )
    except LLMError:
        return []


async def _timed[T](timings: dict[str, int], name: str, work: Awaitable[T]) -> T:
    start = time.perf_counter()
    result = await work
    timings[name] = _ms_since(start)
    return result


def _ms_since(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)
