"""Revise node (safe mode): rewrites the answer without the claims flagged as
hallucinated, and phrases inferred ones as conclusions."""

from app.agent.nodes.generate import format_sources, strip_self_labels
from app.prompts import render
from app.providers.base import LLMError, LLMProvider
from app.schemas import SentenceResult, SourceChunk


def flagged_claims(sentences: list[SentenceResult]) -> list[tuple[str, str, str]]:
    """(label, claim, reason) for every claim that is not high confidence."""
    return [
        (claim.label, claim.text, claim.reason)
        for sentence in sentences
        for claim in sentence.claims
        if claim.label != "high"
    ]


async def revise_answer(
    question: str,
    answer: str,
    sentences: list[SentenceResult],
    sources: list[SourceChunk],
    *,
    provider: LLMProvider,
) -> str | None:
    """The rewritten answer, or None if the rewrite failed (the original still stands)."""
    flagged = flagged_claims(sentences)
    try:
        revised = await provider.generate(
            render(
                "revise_user",
                sources=format_sources(sources),
                question=question,
                answer=answer,
                flagged="\n".join(
                    f"- [{label}] {text} ({reason})" for label, text, reason in flagged
                ),
            ),
            system=render("revise_system"),
        )
    except LLMError:
        return None
    return strip_self_labels(revised) or None
