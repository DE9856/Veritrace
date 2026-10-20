"""Turns verification evidence into scores and labels, then rolls them up.

Phase 2 scores a claim by NLI alone. Phase 3 replaces claim_score with the weighted
formula (entailment, self-consistency, retrieval relevance, self-label).
"""

from dataclasses import dataclass

from app.config import Settings
from app.schemas import (
    ClaimResult,
    ClaimSignals,
    Label,
    LabelCounts,
    NLIVerdict,
    SentenceResult,
    SourceChunk,
)
from app.verification.nli import NLIScores

# Lower rank = weaker. A sentence takes the label of its weakest claim.
LABEL_RANK: dict[Label, int] = {"hallucinated": 0, "inferred": 1, "high": 2}


@dataclass
class ClaimEvidence:
    """Best NLI results for one claim across every retrieved source."""

    sentence_index: int
    text: str
    sentence_citations: list[str]
    support: NLIScores  # scores against the most-entailing source
    support_source: SourceChunk | None
    max_contradiction: float
    contradiction_source: SourceChunk | None


def nli_verdict(entailment: float, contradiction: float) -> NLIVerdict:
    if entailment >= 0.5 and entailment >= contradiction:
        return "entailment"
    if contradiction >= 0.5:
        return "contradiction"
    return "neutral"


def score_claim(ev: ClaimEvidence, settings: Settings) -> ClaimResult:
    entail = ev.support.entailment
    contra = ev.max_contradiction

    contradicted = contra >= settings.contradiction_threshold
    # NLI often reads a passage about a different event (another date, another
    # instrument) as a contradiction. A passage that clearly states the claim wins.
    if contradicted and entail < settings.high_threshold:
        label: Label = "hallucinated"
        score = min(entail, 1.0 - contra)
        source = ev.contradiction_source
        reason = f"Contradicted by {_name(source)} (contradiction {contra:.2f})."
    else:
        score = entail
        source = ev.support_source
        if entail >= settings.high_threshold:
            label = "high"
            reason = f"Stated in {_name(source)} (entailment {entail:.2f})."
            if contradicted:
                reason += (
                    f" A passage in {_name(ev.contradiction_source)} reads as conflicting "
                    f"(contradiction {contra:.2f}), likely because it describes something else."
                )
        elif entail >= settings.inferred_threshold:
            label = "inferred"
            reason = (
                f"Partly supported by {_name(source)} (entailment {entail:.2f}), "
                "but not stated directly."
            )
        else:
            label = "hallucinated"
            reason = f"No source supports this claim (best entailment {entail:.2f})."

    return ClaimResult(
        text=ev.text,
        score=round(max(0.0, min(1.0, score)), 4),
        label=label,
        verdict=nli_verdict(entail, contra),
        signals=ClaimSignals(
            entailment=round(entail, 4),
            neutral=round(ev.support.neutral, 4),
            contradiction=round(contra, 4),
        ),
        evidence_label=source.label if source else None,
        evidence_id=source.chunk_id if source else None,
        evidence_cited=bool(source and source.label in ev.sentence_citations),
        reason=reason,
    )


def build_sentence(index: int, text: str, claims: list[ClaimResult]) -> SentenceResult:
    weakest = min(claims, key=lambda c: (LABEL_RANK[c.label], c.score), default=None)
    return SentenceResult(
        index=index, text=text, label=weakest.label if weakest else None, claims=claims
    )


def roll_up(sentences: list[SentenceResult]) -> tuple[float | None, LabelCounts]:
    claims = [c for s in sentences for c in s.claims]
    counts = LabelCounts()
    for claim in claims:
        setattr(counts, claim.label, getattr(counts, claim.label) + 1)
    if not claims:
        return None, counts
    # Longer claims carry more content, so they weigh more in the overall confidence.
    weights = [len(c.text) for c in claims]
    confidence = sum(c.score * w for c, w in zip(claims, weights, strict=True)) / sum(weights)
    return round(confidence, 4), counts


def _name(source: SourceChunk | None) -> str:
    return source.label if source else "the sources"
