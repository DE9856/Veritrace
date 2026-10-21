"""Synthetic hallucinations: each rule changes exactly one fact and leaves the rest."""

from calibration.synthetic import build, corruptions


def kinds(sentence: str) -> dict[str, str]:
    return dict(corruptions(sentence))


def test_dates_move_by_a_month_and_years_by_one():
    assert kinds("It landed on 23 August 2023.")["date"] == "It landed on 23 September 2023."
    assert kinds("Webb led NASA from 1961 to 1968.")["date"] == "Webb led NASA from 1962 to 1968."


def test_names_glued_to_numbers_are_not_numbers():
    # "LVM3", "Chandrayaan-3" and "L2" carry digits but are names.
    changed = kinds("Chandrayaan-3 flew on an LVM3 rocket to L2, about 100 metres away.")
    assert changed["number"] == "Chandrayaan-3 flew on an LVM3 rocket to L2, about 300 metres away."
    assert changed["entity"] == (
        "Chandrayaan-3 flew on an Ariane 5 rocket to L2, about 100 metres away."
    )


def test_a_swap_never_repeats_a_name_already_there():
    # Either swap would read "the Pragyan rover rolled out of the Pragyan rover", so the
    # sentence gets no name swap at all.
    assert "entity" not in kinds("The Pragyan rover rolled out of the Vikram lander.")


def test_counts_and_negations():
    assert kinds("India became the fourth country.")["count"] == "India became the third country."
    assert kinds("It carried a lander but no orbiter.")["negation"] == (
        "It carried a lander and an orbiter."
    )


def test_the_set_has_controls_and_no_duplicates():
    claims = build()
    texts = [c["claim"] for c in claims]
    assert len(texts) == len(set(texts))
    assert {c["label"] for c in claims if c["kind"] == "original"} == {"high"}
    assert {c["label"] for c in claims if c["kind"] != "original"} == {"hallucinated"}
    assert all(c["original"] != c["claim"] for c in claims if c["kind"] != "original")
