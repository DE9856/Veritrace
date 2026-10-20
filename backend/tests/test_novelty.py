from app.verification.novelty import novelty, stem

PASSAGE = (
    "Chandrayaan-3 was launched on 14 July 2023 aboard an LVM3 rocket. "
    "The spacecraft entered lunar orbit on 5 August 2023."
)


def test_stated_claim_has_nothing_new():
    n = novelty("Chandrayaan-3 was launched aboard an LVM3 rocket.", PASSAGE)
    assert (n.new_words, n.new_numbers, n.share) == ([], [], 0.0)


def test_deduction_brings_new_numbers_and_words():
    n = novelty("Chandrayaan-3 reached lunar orbit about three weeks after launch.", PASSAGE)
    assert n.new_numbers == ["three"]
    assert "reached" in n.new_words


def test_digits_count_as_numbers():
    assert novelty("It was launched on 15 July 2023.", PASSAGE).new_numbers == ["15"]


def test_word_forms_match_through_stemming():
    assert stem("launched") == stem("launch") and stem("landing") == stem("land")
    assert stem("agencies") == stem("agency")
    # Seen live: "successfully achieved" vs the passage's "achieve a soft landing".
    assert stem("achieved") == stem("achieve")
    assert stem("successfully") == stem("successful")
