"""Veritrace's agent, as a LangGraph state graph.

    START -> analyze -> retrieve --(weak evidence, retries left)--> analyze
                                 --(nothing indexed)-------------> no_sources -> END
                                 --(enough evidence)-------------> generate
    generate -> extract -> verify --> judge --------+
                                  --> consistency --+--> score
    score --(safe mode and flagged claims)--> revise -> END
          --(otherwise)-----------------------------> END

Every node emits a "status" event when it starts, and generate streams "draft" events,
so a client can follow the agent step by step.
"""

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import Any

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from app.agent.nodes.analyze import plan_queries
from app.agent.nodes.consistency import consistency_scores, sample_answers
from app.agent.nodes.extract import extract_claims, split_answer
from app.agent.nodes.generate import generate
from app.agent.nodes.judge import judge_claims
from app.agent.nodes.retrieve import retrieve_many
from app.agent.nodes.revise import revise_answer
from app.agent.nodes.verify import verify
from app.agent.state import AgentState
from app.providers.base import LLMError
from app.schemas import ChatRequest, ChatResponse, LabelCounts
from app.services import Services
from app.verification.scoring import build_sentence, needs_judgement, roll_up, score_claim

EMPTY_KB_ANSWER = "The knowledge base is empty. Upload a document first, then ask again."
NO_MATCH_ANSWER = "No passages were found in the selected documents."

EventHandler = Callable[[dict[str, Any]], Awaitable[None]]
Node = Callable[[AgentState], Awaitable[dict[str, Any]]]


class Agent:
    def __init__(self, services: Services):
        self.services = services
        self.settings = services.settings
        self.provider = services.provider
        self.graph = self._build()

    # ------------------------------------------------------------------ graph

    def _build(self):
        g = StateGraph(AgentState)
        nodes: dict[str, Node] = {
            "analyze": self.analyze,
            "retrieve": self.retrieve,
            "no_sources": self.no_sources,
            "generate": self.generate,
            "extract": self.extract,
            "verify": self.verify,
            "judge": self.judge,
            "consistency": self.consistency,
            "score": self.score,
            "revise": self.revise,
        }
        for name, fn in nodes.items():
            g.add_node(name, self._step(name, fn))

        g.add_edge(START, "analyze")
        g.add_edge("analyze", "retrieve")
        g.add_conditional_edges(
            "retrieve",
            self.after_retrieve,
            {"retry": "analyze", "answer": "generate", "empty": "no_sources"},
        )
        g.add_edge("no_sources", END)
        g.add_edge("generate", "extract")
        g.add_edge("extract", "verify")
        # Judge (LLM) and consistency (NLI on samples) are independent: run them in parallel.
        g.add_edge("verify", "judge")
        g.add_edge("verify", "consistency")
        g.add_edge(["judge", "consistency"], "score")
        g.add_conditional_edges("score", self.after_score, {"revise": "revise", "done": END})
        g.add_edge("revise", END)
        return g.compile()

    def _step(self, name: str, fn: Node) -> Node:
        """Wrap a node: announce it, time it, and record it in the trace."""

        async def run(state: AgentState) -> dict[str, Any]:
            get_stream_writer()(
                {"type": "status", "node": name, "message": self.describe(name, state)}
            )
            start = time.perf_counter()
            update = await fn(state)
            elapsed = round((time.perf_counter() - start) * 1000)
            return {**update, "timings": {name: elapsed}, "trace": [name]}

        return run

    def describe(self, name: str, state: AgentState) -> str:
        if name == "analyze" and state.get("attempts"):
            return (
                f"Evidence was weak (best match {state['best_similarity']:.2f}). "
                f"Rewriting the search, retry {state['attempts']} of "
                f"{self.settings.max_retrieval_retries}"
            )
        return {
            "analyze": "Planning search queries",
            "retrieve": "Searching the documents",
            "no_sources": "No documents to search",
            "generate": "Writing the answer",
            "extract": "Splitting the answer into claims",
            "verify": "Checking each claim against the sources",
            "judge": "Reviewing claims the sources do not settle",
            "consistency": "Comparing with resampled answers",
            "score": "Scoring confidence",
            "revise": "Rewriting the answer without the flagged claims",
        }[name]

    # ------------------------------------------------------------------ run

    async def run(self, request: ChatRequest, on_event: EventHandler | None = None) -> ChatResponse:
        initial: AgentState = {
            "request": request,
            "attempts": 0,
            "all_queries": [],
            "timings": {},
            "trace": [],
        }
        final: dict[str, Any] = {}
        try:
            async for mode, chunk in self.graph.astream(initial, stream_mode=["custom", "values"]):
                if mode == "custom":
                    if on_event:
                        await on_event(chunk)
                else:
                    final = chunk
        finally:
            sampling = final.get("sampling")
            if sampling and not sampling.done():
                sampling.cancel()
        return final["response"].model_copy(
            update={"timings_ms": final["timings"], "trace": final["trace"]}
        )

    # ------------------------------------------------------------------ retrieval loop

    async def analyze(self, state: AgentState) -> dict[str, Any]:
        retrying = state["attempts"] > 0
        queries = await plan_queries(
            state["request"].question,
            provider=self.provider,
            previous=state["all_queries"] if retrying else None,
            best_similarity=state.get("best_similarity"),
        )
        return {"queries": queries, "all_queries": state["all_queries"] + queries}

    async def retrieve(self, state: AgentState) -> dict[str, Any]:
        request = state["request"]
        # Search with every query tried so far, so a retry can only improve the evidence.
        sources = await retrieve_many(
            state["all_queries"],
            embedder=self.services.embedder,
            store=self.services.store,
            k=request.top_k or self.settings.top_k,
            document_ids=request.document_ids,
        )
        best = sources[0].similarity if sources else 0.0
        return {
            "sources": sources,
            "best_similarity": best,
            "low_coverage": bool(sources) and best < self.settings.evidence_threshold,
            "attempts": state["attempts"] + 1,
        }

    def after_retrieve(self, state: AgentState) -> str:
        if not state["sources"]:
            return "empty"
        if state["low_coverage"] and state["attempts"] <= self.settings.max_retrieval_retries:
            return "retry"
        return "answer"

    async def no_sources(self, state: AgentState) -> dict[str, Any]:
        empty = self.services.store.count() == 0
        return {
            "response": self._response(state, answer=EMPTY_KB_ANSWER if empty else NO_MATCH_ANSWER)
        }

    # ------------------------------------------------------------------ answer

    async def generate(self, state: AgentState) -> dict[str, Any]:
        write = get_stream_writer()
        generated = await generate(
            state["request"].question,
            state["sources"],
            provider=self.provider,
            on_draft=lambda text: write({"type": "draft", "text": text}),
        )
        return {"generated": generated, "sentences": split_answer(generated.tagged)}

    async def extract(self, state: AgentState) -> dict[str, Any]:
        # Extraction is created first so its request reaches the LLM before the samples.
        extraction = asyncio.create_task(
            extract_claims(state["request"].question, state["sentences"], provider=self.provider)
        )
        # The samples keep the GPU busy while verify runs NLI on the CPU; the
        # consistency node collects them.
        sampling = asyncio.create_task(self._samples(state))
        claims, fallback = await extraction
        return {"claims": claims, "extraction_fallback": fallback, "sampling": sampling}

    async def _samples(self, state: AgentState) -> list[str]:
        try:
            return await sample_answers(
                state["request"].question,
                state["sources"],
                provider=self.provider,
                n=self.settings.consistency_samples,
                temperature=self.settings.sample_temperature,
            )
        except LLMError:
            return []  # consistency is then left out of the score

    # ------------------------------------------------------------------ verification

    async def verify(self, state: AgentState) -> dict[str, Any]:
        evidence = await verify(
            state["claims"],
            state["sentences"],
            state["sources"],
            embedder=self.services.embedder,
            nli=self.services.nli,
            window_size=self.settings.nli_window_sentences,
            per_claim=self.settings.nli_windows_per_claim,
        )
        labels = {s.index: s.self_label for s in state["sentences"]}
        for ev in evidence:
            ev.self_label = labels.get(ev.sentence_index)
        return {"evidence": evidence}

    async def judge(self, state: AgentState) -> dict[str, Any]:
        if not self.settings.judge_enabled:
            return {"judgements": {}}
        to_judge = {
            i: ev.text
            for i, ev in enumerate(state["evidence"])
            if needs_judgement(ev, self.settings)
        }
        return {
            "judgements": await judge_claims(to_judge, state["sources"], provider=self.provider)
        }

    async def consistency(self, state: AgentState) -> dict[str, Any]:
        samples = await state["sampling"]
        scores = await consistency_scores(state["claims"], samples, nli=self.services.nli)
        return {"consistency": scores}

    async def score(self, state: AgentState) -> dict[str, Any]:
        evidence = state["evidence"]
        for ev, cons in zip(evidence, state["consistency"], strict=True):
            ev.consistency = cons
        for i, judgement in state["judgements"].items():
            evidence[i].judge = judgement.verdict
            evidence[i].judge_reason = judgement.reason

        by_sentence: dict[int, list] = {s.index: [] for s in state["sentences"]}
        for ev in evidence:
            by_sentence[ev.sentence_index].append(score_claim(ev, self.settings))
        sentences = [
            build_sentence(s.index, s.text, by_sentence[s.index]) for s in state["sentences"]
        ]
        confidence, counts = roll_up(sentences)
        generated = state["generated"]
        return {
            "response": self._response(
                state,
                answer=generated.answer,
                answer_confidence=confidence,
                counts=counts,
                sentences=sentences,
                extraction_fallback=state["extraction_fallback"],
                cited_labels=generated.cited_labels,
                invalid_citations=generated.invalid_citations,
                sources=state["sources"],
            )
        }

    def after_score(self, state: AgentState) -> str:
        flagged = state["response"].counts.hallucinated > 0
        return "revise" if state["request"].safe_mode and flagged else "done"

    async def revise(self, state: AgentState) -> dict[str, Any]:
        response = state["response"]
        revised = await revise_answer(
            state["request"].question,
            response.answer,
            response.sentences,
            response.sources,
            provider=self.provider,
        )
        return {"response": response.model_copy(update={"revised_answer": revised})}

    # ------------------------------------------------------------------ helpers

    def _response(self, state: AgentState, **fields: Any) -> ChatResponse:
        defaults: dict[str, Any] = {
            "answer_confidence": None,
            "counts": LabelCounts(),
            "sentences": [],
            "extraction_fallback": False,
            "cited_labels": [],
            "invalid_citations": [],
            "sources": [],
        }
        return ChatResponse(
            **{**defaults, **fields},
            queries=state.get("all_queries", []),
            retrieval_attempts=state.get("attempts", 0),
            low_coverage=state.get("low_coverage", False),
            provider=self.provider.name,
            model=self.provider.model,
            timings_ms={},
        )
