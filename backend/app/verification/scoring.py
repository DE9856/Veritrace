"""Turns verification signals into a confidence score and label per claim, then rolls
them up to sentences and the whole answer.

score = weighted average of the available signals:
    entailment   best NLI entailment against the source passages      (0.65)
    consistency  how often resampled answers also state the claim     (0.15)
    retrieval    how closely the supporting passage matches the claim (0.10)
    self_label   the generator's own HIGH / INFERRED / UNSURE tag     (0.10)
(weights from config.yaml, tuned in calibration/)

Evidence decides the label; the other signals adjust the score within it. In order:
1. The judge finds the claim contradicted -> hallucinated.
2. NLI could not confirm the claim (low entailment, or a contradiction), but the judge
   finds it derivable from the evidence -> inferred.
3. NLI contradiction and no passage clearly states the claim -> hallucinated.
4. Entailment below the inferred threshold -> hallucinated. Consistency or a confident
   self-label cannot rescue an unsupported claim, because a model can be consistently wrong.
5. Strong entailment with consistent samples -> high; otherwise the score decides
   between high and inferred.
6. A "high" claim that brings a new number, or many new words, compared with its
   passage is a deduction the passage does not state -> inferred.

The judge only sees claims NLI did not cleanly confirm (see needs_judgement).
"""

from dataclasses import dataclass, field

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
SELF_LABEL_VALUE = {"HIGH": 1.0, "INFERRED": 0.5, "UNSURE": 0.2}
# Below this share of agreeing samples, a reason mentions the inconsistency.
LOW_CONSISTENCY = 0.34


@dataclass
class ClaimEvidence:
    """Every signal collected for one claim."""

    sentence_index: int
    text: str
    sentence_citations: list[str]
    support: NLIScores  # NLI scores against the most-entailing passage
    support_source: SourceChunk | None
    max_contradiction: float
    contradiction_source: SourceChunk | None
    support_similarity: float = 0.0  # cosine similarity of claim and supporting passage
    support_passage: str = ""  # the window NLI read, with its document title in front
    new_words: list[str] = field(default_factory=list)  # claim words the passage lacks
    new_numbers: list[str] = field(default_factory=list)
    novelty_share: float = 0.0
    consistency: float | None = None  # None when sampling is off
    self_label: str | None = None  # None when the generator did not tag the sentence
    judge: str | None = None  # "derivable" / "contradicted" / "unsupported"; None if not judged
    judge_reason: str | None = None


def nli_verdict(entailment: float, contradiction: float) -> NLIVerdict:
    if entailment >= 0.5 and entailment >= contradiction:
        return "entailment"
    if contradiction >= 0.5:
        return "contradiction"
    return "neutral"


def is_contradicted(ev: ClaimEvidence, settings: Settings) -> bool:
    # NLI often reads a passage about a different event (another date, another
    # instrument) as a contradiction. Without a judge, a passage that clearly states
    # the claim wins.
    return (
        ev.max_contradiction >= settings.contradiction_threshold
        and ev.support.entailment < settings.high_threshold
    )


def needs_judgement(ev: ClaimEvidence, settings: Settings) -> bool:
    """Claims NLI did not cleanly confirm go to the judge: anything below the high
    threshold, and anything with a strong contradiction even if another passage
    supports it ("carried an orbiter, a lander and a rover": the lander and rover are
    stated, the orbiter is contradicted)."""
    return (
        ev.support.entailment < settings.high_threshold
        or ev.max_contradiction >= settings.contradiction_threshold
    )


def relevance(similarity: float, settings: Settings) -> float:
    span = settings.relevance_ceiling - settings.relevance_floor
    return min(1.0, max(0.0, (similarity - settings.relevance_floor) / span))


def weighted_score(ev: ClaimEvidence, settings: Settings) -> float:
    parts = [
        (settings.weight_entailment, ev.support.entailment),
        (settings.weight_retrieval, relevance(ev.support_similarity, settings)),
    ]
    if ev.consistency is not None:
        parts.append((settings.weight_consistency, ev.consistency))
    if ev.self_label in SELF_LABEL_VALUE:
        parts.append((settings.weight_self_label, SELF_LABEL_VALUE[ev.self_label]))
    # Missing signals drop out and the remaining weights are renormalised.
    return sum(w * v for w, v in parts) / sum(w for w, _ in parts)


def is_novel(ev: ClaimEvidence, settings: Settings) -> bool:
    return bool(ev.new_numbers) or ev.novelty_share >= settings.novelty_threshold


def score_claim(ev: ClaimEvidence, settings: Settings) -> ClaimResult:
    entail = ev.support.entailment
    contra = ev.max_contradiction
    cons = ev.consistency
    score = weighted_score(ev, settings)
    below_inferred = settings.inferred_threshold - 0.01
    below_high = settings.high_threshold - 0.01
    judge_note = f" Judge: {ev.judge_reason}" if ev.judge_reason else ""
    contradicted = is_contradicted(ev, settings)
    unconfirmed = entail < settings.inferred_threshold or contradicted
    source = ev.support_source

    if ev.judge == "contradicted":
        label: Label = "hallucinated"
        score = min(score, 1.0 - contra, below_inferred)
        source = ev.contradiction_source if contra >= 0.5 else ev.support_source
        reason = "The sources conflict with this claim." + judge_note
    elif unconfirmed and ev.judge == "derivable":
        label = "inferred"
        score = min(max(score, settings.inferred_threshold), below_high)
        reason = "Not stated in any passage, but follows from the evidence." + judge_note
        if contradicted:
            reason += f" NLI read a conflict with {_name(ev.contradiction_source)} ({contra:.2f})."
    elif contradicted:
        label = "hallucinated"
        score = min(score, 1.0 - contra, below_inferred)
        source = ev.contradiction_source
        reason = f"Contradicted by {_name(source)} (contradiction {contra:.2f})." + judge_note
    elif entail < settings.inferred_threshold:
        label = "hallucinated"
        score = min(score, below_inferred)
        reason = f"No source supports this claim (best entailment {entail:.2f})." + judge_note
    else:
        strong = entail >= settings.strong_entailment and (
            cons is None or cons >= settings.strong_consistency
        )
        if strong or score >= settings.high_threshold:
            label = "high"
            score = max(score, settings.high_threshold)
            reason = f"Stated in {_name(source)} (entailment {entail:.2f})."
        else:
            label = "inferred"
            score = max(score, settings.inferred_threshold)
            reason = (
                f"Partly supported by {_name(source)} (entailment {entail:.2f}), "
                "but not stated directly."
            )
        if label == "high" and is_novel(ev, settings):
            label = "inferred"
            score = min(score, below_high)
            new = ", ".join((ev.new_numbers or ev.new_words)[:4])
            reason = (
                f"Follows from {_name(source)} (entailment {entail:.2f}), but the passage "
                f"does not say it in these words (new: {new})."
            )

    if cons is not None and cons < LOW_CONSISTENCY and label != "hallucinated":
        reason += f" Resampled answers rarely repeat it (consistency {cons:.2f})."
    if label == "high" and contra >= settings.contradiction_threshold:
        reason += (
            f" A passage in {_name(ev.contradiction_source)} reads as conflicting "
            f"(contradiction {contra:.2f}), likely because it describes something else."
        )

    return ClaimResult(
        text=ev.text,
        score=round(max(0.0, min(1.0, score)), 4),
        label=label,
        verdict=nli_verdict(entail, contra),
        signals=ClaimSignals(
            entailment=round(entail, 4),
            neutral=round(ev.support.neutral, 4),
            contradiction=round(contra, 4),
            consistency=None if cons is None else round(cons, 4),
            retrieval=round(relevance(ev.support_similarity, settings), 4),
            self_label=ev.self_label,
            judge=ev.judge,
            new_terms=ev.new_words,
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
