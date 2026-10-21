"""Phase 3 scoring: the weighted score, the evidence gate and the override rules."""

from app.config import Settings
from app.schemas import SourceChunk
from app.verification.nli import NLIScores
from app.verification.scoring import (
    ClaimEvidence,
    needs_judgement,
    relevance,
    score_claim,
    weighted_score,
)

SETTINGS = Settings(_env_file=None)
SOURCE = SourceChunk(
    label="S1",
    chunk_id="doc_p1_c0",
    document_id="doc",
    filename="f.pdf",
    title="Doc",
    page=1,
    text="x.",
    similarity=0.8,
)


def ev(
    entail: float,
    *,
    contra: float = 0.0,
    sim: float = 0.9,
    cons: float | None = None,
    label: str | None = None,
    judge: str | None = None,
) -> ClaimEvidence:
    return ClaimEvidence(
        sentence_index=0,
        text="A claim.",
        sentence_citations=["S1"],
        support=NLIScores(entail, max(0.0, 1 - entail - contra), contra),
        support_source=SOURCE,
        max_contradiction=contra,
        contradiction_source=SOURCE,
        support_similarity=sim,
        consistency=cons,
        self_label=label,
        judge=judge,
        judge_reason="scripted" if judge else None,
    )


def test_weighted_score_uses_all_four_signals():
    # 0.65*0.8 + 0.15*0.5 + 0.10*1.0 + 0.10*0.5 = 0.745
    assert round(weighted_score(ev(0.8, cons=0.5, label="INFERRED"), SETTINGS), 4) == 0.745


def test_missing_signals_drop_out_and_weights_renormalise():
    # Only entailment and retrieval: (0.65*0.8 + 0.10*1.0) / 0.75
    assert round(weighted_score(ev(0.8), SETTINGS), 4) == round(0.62 / 0.75, 4)


def test_relevance_maps_similarity_onto_zero_to_one():
    assert relevance(0.4, SETTINGS) == 0.0
    assert round(relevance(0.7, SETTINGS), 6) == 0.5
    assert relevance(0.95, SETTINGS) == 1.0


def test_consistency_decides_a_borderline_claim():
    # 0.65*0.8 + 0.15*cons + 0.10 + 0.10: 0.72 with no agreeing samples, 0.87 with all.
    inconsistent = score_claim(ev(0.8, cons=0.0, label="HIGH"), SETTINGS)
    assert inconsistent.label == "inferred"
    assert "rarely repeat" in inconsistent.reason
    assert score_claim(ev(0.8, cons=1.0, label="HIGH"), SETTINGS).label == "high"


def test_consistent_samples_promote_a_borderline_claim():
    assert score_claim(ev(0.7, cons=1.0, label="HIGH"), SETTINGS).label == "high"


def test_strong_entailment_with_consistency_is_high():
    result = score_claim(ev(0.9, cons=0.9, sim=0.5, label="UNSURE"), SETTINGS)
    assert result.label == "high"
    assert result.score >= SETTINGS.high_threshold


def test_consistent_confident_hallucination_is_not_rescued():
    # The model repeats an unsupported claim every time and tags it HIGH.
    result = score_claim(ev(0.05, cons=1.0, label="HIGH"), SETTINGS)
    assert result.label == "hallucinated"
    assert result.score < SETTINGS.inferred_threshold


def test_judge_rescues_a_derivable_claim_as_inferred():
    result = score_claim(ev(0.1, cons=0.8, judge="derivable"), SETTINGS)
    assert result.label == "inferred"
    assert result.score >= SETTINGS.inferred_threshold
    assert result.signals.judge == "derivable"
    assert "follows from the evidence" in result.reason


def test_judge_can_overrule_a_misread_contradiction_but_only_to_inferred():
    # Seen live: "worked for roughly two weeks" read as contradicted (0.99) by NLI.
    result = score_claim(ev(0.01, contra=0.99, cons=1.0, label="HIGH", judge="derivable"), SETTINGS)
    assert result.label == "inferred"
    assert result.score < SETTINGS.high_threshold
    assert "NLI read a conflict" in result.reason


def test_judge_can_flag_a_contradiction_nli_missed():
    result = score_claim(ev(0.2, judge="contradicted"), SETTINGS)
    assert result.label == "hallucinated"
    assert result.reason.startswith("The sources conflict with this claim.")


def test_nli_contradiction_stands_without_a_judge():
    assert score_claim(ev(0.1, contra=0.9), SETTINGS).label == "hallucinated"


def test_claims_nli_did_not_cleanly_confirm_are_judged():
    assert needs_judgement(ev(0.2), SETTINGS)  # unsupported
    assert needs_judgement(ev(0.2, contra=0.9), SETTINGS)  # contradicted
    assert needs_judgement(ev(0.6), SETTINGS)  # only partly supported
    assert needs_judgement(ev(0.98, contra=0.99), SETTINGS)  # supported and contradicted
    assert not needs_judgement(ev(0.9), SETTINGS)  # clearly stated, no conflict


def test_judge_settles_a_claim_both_supported_and_contradicted():
    # Calibration case: "carried an orbiter, a lander and a rover" (E=0.98, C=1.00).
    wrong = score_claim(ev(0.98, contra=1.0, cons=0.0, judge="contradicted"), SETTINGS)
    assert wrong.label == "hallucinated"
    # Calibration case: "launched on 14 July 2023" (E=1.00, C=0.98), judge agrees.
    right = score_claim(ev(1.0, contra=0.98, cons=1.0, judge="derivable"), SETTINGS)
    assert right.label == "high"


def test_judge_contradiction_overrides_partial_support():
    # Calibration case: "woke up successfully after the lunar night" (E=0.70).
    assert score_claim(ev(0.7, cons=0.0, judge="contradicted"), SETTINGS).label == "hallucinated"


def test_a_new_number_makes_a_supported_claim_inferred():
    novel = ev(0.98, cons=1.0)
    novel.new_numbers, novel.new_words = ["three"], ["reached", "three"]
    result = score_claim(novel, SETTINGS)
    assert result.label == "inferred"
    assert "new: three" in result.reason
    assert result.signals.new_terms == ["reached", "three"]


def test_many_new_words_make_a_supported_claim_inferred():
    novel = ev(1.0, cons=1.0)
    novel.new_words, novel.novelty_share = ["collaboration", "europe"], 0.6
    assert score_claim(novel, SETTINGS).label == "inferred"
    assert score_claim(ev(1.0, cons=1.0), SETTINGS).label == "high"


def test_judge_keeps_a_paraphrase_high_but_not_a_new_quantity():
    paraphrase = ev(1.0, cons=1.0, judge="stated")
    paraphrase.new_words, paraphrase.novelty_share = ["lifted"], 0.25
    assert needs_judgement(paraphrase, SETTINGS)
    result = score_claim(paraphrase, SETTINGS)
    assert result.label == "high"
    assert "other words (new: lifted)" in result.reason

    counted = ev(1.0, cons=1.0, judge="stated")
    counted.new_numbers, counted.new_words = ["month"], ["reached", "month"]
    assert not needs_judgement(counted, SETTINGS)
    assert score_claim(counted, SETTINGS).label == "inferred"


def test_judge_cannot_overrule_nli_on_a_claim_sent_only_for_new_words():
    # NLI confirmed it; the judge only decides between high and inferred.
    novel = ev(1.0, cons=1.0, judge="contradicted")
    novel.new_words, novel.novelty_share = ["nation", "close"], 0.25
    assert score_claim(novel, SETTINGS).label == "inferred"


def test_signals_are_reported():
    signals = score_claim(ev(0.9, cons=0.75, label="HIGH"), SETTINGS).signals
    assert (signals.consistency, signals.retrieval, signals.self_label) == (0.75, 1.0, "HIGH")
