"""Answer splitting, self-labels and claim clean-up, using cases seen with the live model."""

from app.agent.nodes.extract import NameRepair, is_about_sources, split_answer
from app.agent.nodes.generate import strip_self_labels


def test_self_labels_are_read_per_sentence_and_removed_from_text():
    sentences = split_answer("Landed in 2023 [S1] {HIGH}. It means success [S1] {inferred}.")
    assert [s.self_label for s in sentences] == ["HIGH", "INFERRED"]
    assert [s.text for s in sentences] == ["Landed in 2023 [S1].", "It means success [S1]."]


def test_tag_attached_to_the_next_sentence_is_moved_back():
    sentences = split_answer("Landed in 2023. [S2] {HIGH} Next one.")
    assert [(s.text, s.self_label) for s in sentences] == [
        ("Landed in 2023. [S2]", "HIGH"),
        ("Next one.", None),
    ]


def test_citation_used_as_a_subject_stays_in_its_sentence():
    sentences = split_answer("No ice is mentioned. [S1] mentions sulphur only.")
    assert sentences[1].text == "[S1] mentions sulphur only."
    assert sentences[1].citations == ["S1"]


def test_strip_self_labels_leaves_clean_prose():
    assert (
        strip_self_labels("A fact [S1] {HIGH}. Another [S2] {UNSURE}.")
        == "A fact [S1]. Another [S2]."
    )


def test_garbled_names_are_repaired_from_the_answer():
    repair = NameRepair("The Pragyan rover found iron, unlike Chandrayaan-2's lander.")
    assert repair.repair("The Praginois rover found iron.") == "The Pragyan rover found iron."
    assert repair.repair("The Prag่าน rover found iron.") == "The Pragyan rover found iron."
    assert repair.repair("Chandray-2's lander crashed.") == "Chandrayaan-2's lander crashed."


def test_ordinary_words_and_new_names_are_left_alone():
    repair = NameRepair("The Pragyan rover found iron. Engineers made pragmatic choices.")
    for claim in ["India landed first.", "The Moon has sulphur.", "Pragmatic choices were made."]:
        assert repair.repair(claim) == claim


def test_name_from_another_sentence_is_repaired():
    # Seen live: "It also detected chromium" -> claim "The Pragiad rover detected chromium".
    repair = NameRepair("The Pragyan rover landed. It also detected chromium.")
    assert (
        repair.repair("The Pragiad rover detected chromium.")
        == "The Pragyan rover detected chromium."
    )


def test_lone_punctuation_after_a_refusal_is_not_a_sentence():
    sentences = split_answer(
        "The provided documents don't contain this information. [S1] {UNSURE}."
    )
    assert len(sentences) == 1


def test_no_source_statements_are_recognised():
    assert is_about_sources("No source addresses water ice detection by the rover.")
    assert not is_about_sources("No rover detected water ice.")
    # Seen live on a test question: a statement about what the sources leave out.
    assert is_about_sources(
        "No other experiments are mentioned as being performed by the Vikram lander on "
        "the surface in the provided sources."
    )
    assert not is_about_sources("No other lander was described in news reports.")
