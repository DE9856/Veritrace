from app.agent.nodes.extract import ExtractedClaim, split_answer
from app.agent.nodes.verify import build_windows, select_windows
from app.config import Settings
from app.schemas import SourceChunk
from app.verification.nli import NLIScores
from app.verification.scoring import ClaimEvidence, build_sentence, roll_up, score_claim

SETTINGS = Settings(_env_file=None)


def source(label: str, text: str = "x.") -> SourceChunk:
    return SourceChunk(
        label=label,
        chunk_id=f"doc_p1_c{label}",
        document_id="doc",
        filename="f.pdf",
        title="Doc",
        page=1,
        text=text,
        similarity=0.8,
    )


def evidence(entail: float, contra: float = 0.0, cited: list[str] | None = None) -> ClaimEvidence:
    return ClaimEvidence(
        sentence_index=0,
        text="A claim.",
        sentence_citations=cited if cited is not None else ["S1"],
        support=NLIScores(entail, 1 - entail - contra, contra),
        support_source=source("S1"),
        max_contradiction=contra,
        contradiction_source=source("S2"),
    )


# ---------- labels ----------


def test_entailed_claim_is_high_confidence():
    result = score_claim(evidence(0.95), SETTINGS)
    assert (result.label, result.verdict, result.evidence_label) == ("high", "entailment", "S1")
    assert result.evidence_cited is True
    assert result.reason.startswith("Stated in S1")


def test_partly_supported_claim_is_inferred():
    result = score_claim(evidence(0.6), SETTINGS)
    assert result.label == "inferred"
    assert SETTINGS.inferred_threshold <= result.score < SETTINGS.high_threshold


def test_unsupported_claim_is_hallucinated():
    result = score_claim(evidence(0.05), SETTINGS)
    assert (result.label, result.verdict) == ("hallucinated", "neutral")
    assert "No source supports" in result.reason


def test_contradiction_overrides_support_and_points_to_contradicting_source():
    result = score_claim(evidence(0.0, contra=0.9), SETTINGS)
    assert (result.label, result.verdict, result.evidence_label) == (
        "hallucinated",
        "contradiction",
        "S2",
    )
    assert result.evidence_cited is False


def test_support_from_an_uncited_source_is_flagged():
    assert score_claim(evidence(0.95, cited=["S3"]), SETTINGS).evidence_cited is False


# ---------- roll-up ----------


def test_sentence_takes_weakest_claim_and_answer_is_length_weighted():
    high = score_claim(evidence(1.0), SETTINGS)
    weak = score_claim(evidence(0.0), SETTINGS).model_copy(update={"text": "A much longer claim."})
    sentence = build_sentence(0, "Text.", [high, weak])
    assert sentence.label == "hallucinated"

    confidence, counts = roll_up([sentence, build_sentence(1, "No claims.", [])])
    assert (counts.high, counts.inferred, counts.hallucinated) == (1, 0, 1)
    # Weighted by length: "A claim." is 8 characters, "A much longer claim." is 20.
    assert confidence == round((high.score * 8 + weak.score * 20) / 28, 4)


def test_answer_without_claims_has_no_confidence():
    assert roll_up([build_sentence(0, "The documents don't say.", [])])[0] is None


# ---------- answer splitting ----------


def test_split_answer_keeps_citations_with_their_sentence():
    sentences = split_answer("Landed in 2023 [S1]. Found sulphur. [S2][S3] Nothing on cost.")
    assert [s.text for s in sentences] == [
        "Landed in 2023 [S1].",
        "Found sulphur. [S2][S3]",
        "Nothing on cost.",
    ]
    assert [s.citations for s in sentences] == [["S1"], ["S2", "S3"], []]
    assert [s.plain for s in sentences] == ["Landed in 2023.", "Found sulphur.", "Nothing on cost."]


# ---------- evidence windows ----------


def test_windows_slide_over_sentences():
    windows = build_windows([source("S1", "A one. B two. C three. D four.")], size=3)
    assert [w.text for w in windows] == ["A one. B two. C three.", "B two. C three. D four."]


def test_cited_source_is_always_checked_even_if_not_closest():
    windows = build_windows([source("S1", "Close."), source("S2", "Far.")], size=3)
    claims = [ExtractedClaim(0, "claim")]
    sentences = split_answer("Claim [S2].")
    selected = select_windows([[1.0, 0.0]], windows, claims, sentences, 1)
    assert selected == [[0, 1]]


def test_clear_support_beats_contradiction_from_an_unrelated_passage():
    # Seen live: "landed on 23 August" was entailed by the landing passage but read as
    # contradicted by a passage about the 3 September hop experiment.
    result = score_claim(evidence(0.99, contra=0.98), SETTINGS)
    assert result.label == "high"
    assert "reads as conflicting" in result.reason


def test_contradiction_with_weak_support_is_still_hallucinated():
    assert score_claim(evidence(0.6, contra=0.9), SETTINGS).label == "hallucinated"


# ---------- statements about the sources ----------


def test_statements_about_missing_information_are_recognised():
    from app.agent.nodes.extract import is_about_sources

    for text in [
        "The provided documents don't contain this information.",
        "The sources do not say whether the rover found ice.",
        "There is no information about the cost in the documents.",
        "The landing site of Chandrayaan-2 is not mentioned in the sources.",
    ]:
        assert is_about_sources(text), text
    for text in [
        "According to the sources, the rover did not wake up.",
        "The rover found no water ice.",
        "Vikram landed on 23 August 2023.",
    ]:
        assert not is_about_sources(text), text


# ---------- window ranking ----------


def test_word_overlap_lifts_the_window_with_the_matching_date():
    windows = build_windows(
        [
            source("S1", "The hop happened on 3 September 2023."),
            source("S2", "It landed on 23 August 2023."),
        ],
        size=3,
    )
    claims = [ExtractedClaim(0, "It landed on 23 August 2023.")]
    # Embeddings slightly prefer the wrong window; shared words decide it.
    selected = select_windows([[0.9, 0.8]], windows, claims, split_answer("x"), 1)
    assert selected == [[1]]
