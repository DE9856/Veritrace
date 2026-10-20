"""Question pipeline: retrieve -> generate -> extract claims -> verify -> score.

This is a plain sequential runner. In Phase 4 the same nodes are wired into a
LangGraph StateGraph (graph.py) with the retry loop and the remaining checks.
"""

import time

from app.agent.nodes.extract import extract_claims, split_answer
from app.agent.nodes.generate import generate
from app.agent.nodes.retrieve import retrieve
from app.agent.nodes.verify import verify
from app.schemas import ChatRequest, ChatResponse, LabelCounts
from app.services import Services
from app.verification.scoring import build_sentence, roll_up, score_claim

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

    start = time.perf_counter()
    answer_sentences = split_answer(generated.answer)
    claims, used_fallback = await extract_claims(
        request.question, answer_sentences, provider=provider
    )
    timings["extract"] = _ms_since(start)

    start = time.perf_counter()
    evidence = await verify(
        claims,
        answer_sentences,
        sources,
        embedder=services.embedder,
        nli=services.nli,
        window_size=settings.nli_window_sentences,
        per_claim=settings.nli_windows_per_claim,
    )
    timings["verify"] = _ms_since(start)

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


def _ms_since(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)
