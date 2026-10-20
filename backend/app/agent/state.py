"""The state every node of the agent graph reads and updates."""

import asyncio
import operator
from typing import Annotated, TypedDict

from app.agent.nodes.extract import AnswerSentence, ExtractedClaim
from app.agent.nodes.generate import GeneratedAnswer
from app.agent.nodes.judge import Judgement
from app.schemas import ChatRequest, ChatResponse, SourceChunk
from app.verification.scoring import ClaimEvidence


def add_timings(left: dict[str, int], right: dict[str, int]) -> dict[str, int]:
    """Sum durations per step: analyze and retrieve run again on every retry."""
    return {k: left.get(k, 0) + right.get(k, 0) for k in left.keys() | right.keys()}


class AgentState(TypedDict, total=False):
    request: ChatRequest

    # Retrieval loop
    queries: list[str]  # queries of the latest attempt
    all_queries: list[str]  # every query tried, for the response
    attempts: int
    sources: list[SourceChunk]
    best_similarity: float
    low_coverage: bool

    # Answer
    generated: GeneratedAnswer
    sentences: list[AnswerSentence]
    # Resampled answers, started in the background by the extract node so the GPU keeps
    # sampling while NLI runs on the CPU; the consistency node collects them.
    sampling: asyncio.Task

    # Verification
    claims: list[ExtractedClaim]
    extraction_fallback: bool
    evidence: list[ClaimEvidence]
    judgements: dict[int, Judgement]
    consistency: list[float | None]

    response: ChatResponse

    # Written by parallel branches, so they need reducers that combine updates.
    timings: Annotated[dict[str, int], add_timings]
    trace: Annotated[list[str], operator.add]
