"""Phase 1 question pipeline: retrieve -> generate.

This is a plain sequential runner. In Phase 4 the same nodes are wired into a
LangGraph StateGraph (graph.py) with the retry loop and verification steps.
"""

import time

from app.agent.nodes.generate import generate
from app.agent.nodes.retrieve import retrieve
from app.ingestion.embedder import Embedder
from app.providers.base import LLMProvider
from app.schemas import ChatRequest, ChatResponse
from app.store.chroma import VectorStore

EMPTY_KB_ANSWER = "The knowledge base is empty. Upload a document first, then ask again."
NO_MATCH_ANSWER = "No passages were found in the selected documents."


async def answer_question(
    request: ChatRequest,
    *,
    provider: LLMProvider,
    embedder: Embedder,
    store: VectorStore,
    default_k: int,
) -> ChatResponse:
    timings: dict[str, int] = {}

    start = time.perf_counter()
    sources = await retrieve(
        request.question,
        embedder=embedder,
        store=store,
        k=request.top_k or default_k,
        document_ids=request.document_ids,
    )
    timings["retrieve"] = _ms_since(start)

    if not sources:
        return ChatResponse(
            answer=EMPTY_KB_ANSWER if store.count() == 0 else NO_MATCH_ANSWER,
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

    return ChatResponse(
        answer=generated.answer,
        cited_labels=generated.cited_labels,
        invalid_citations=generated.invalid_citations,
        sources=sources,
        provider=provider.name,
        model=provider.model,
        timings_ms=timings,
    )


def _ms_since(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)
