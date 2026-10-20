"""Consistency node: asks the same question again at a higher temperature and measures
how many of the extra answers also state each claim (the SelfCheckGPT idea).

A fact grounded in the sources tends to reappear in every sample. A hallucinated detail
tends to change or disappear between samples.
"""

import asyncio
import re

from app.agent.nodes.extract import ExtractedClaim
from app.agent.nodes.generate import format_sources, strip_self_labels
from app.prompts import render
from app.providers.base import LLMProvider
from app.schemas import SourceChunk
from app.verification.nli import NLIModel

_CITATIONS = re.compile(r"\s*\[S\d+(?:\s*[,;]\s*S\d+)*\]")


async def sample_answers(
    question: str,
    sources: list[SourceChunk],
    *,
    provider: LLMProvider,
    n: int,
    temperature: float,
) -> list[str]:
    if n <= 0:
        return []
    samples = await provider.sample(
        render("generate_user", sources=format_sources(sources), question=question),
        n,
        system=render("generate_system"),
        temperature=temperature,
    )
    # Tags and citations are noise for NLI; keep only the prose.
    return [_CITATIONS.sub("", strip_self_labels(s)).strip() for s in samples]


def _consistency_sync(
    claims: list[ExtractedClaim], samples: list[str], nli: NLIModel
) -> list[float | None]:
    if not samples or not claims:
        return [None] * len(claims)
    pairs = [(sample, claim.text) for claim in claims for sample in samples]
    scores = nli.predict(pairs)
    n = len(samples)
    return [sum(s.entailment for s in scores[i * n : (i + 1) * n]) / n for i in range(len(claims))]


async def consistency_scores(
    claims: list[ExtractedClaim], samples: list[str], *, nli: NLIModel
) -> list[float | None]:
    """For each claim, the average probability that a resampled answer entails it.
    None when sampling is turned off."""
    return await asyncio.to_thread(_consistency_sync, claims, samples, nli)
