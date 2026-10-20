import pytest

from app.ingestion.chunker import chunk_pages, split_sentences
from app.ingestion.parser import Page, clean_text


def words(text: str) -> int:
    return len(text.split())


def test_clean_text_joins_wrapped_lines_and_hyphens():
    raw = "The rover con-\nfirmed sulphur\nnear the site.\n\nNew paragraph."
    assert clean_text(raw) == "The rover confirmed sulphur near the site.\n\nNew paragraph."


def test_split_sentences_handles_abbreviations():
    sentences = split_sentences("Dr. Rao led the team. It landed on Aug. 23. Then it rested.")
    assert sentences == ["Dr. Rao led the team.", "It landed on Aug. 23.", "Then it rested."]


def test_chunks_respect_token_limit_and_overlap():
    text = " ".join(f"Sentence number {i} has exactly seven words." for i in range(20))
    chunks = chunk_pages([Page(1, text)], words, max_tokens=21, overlap_tokens=7)

    assert all(c.token_count <= 21 for c in chunks)
    # Each chunk after the first starts with the last sentence of the previous one.
    for prev, nxt in zip(chunks, chunks[1:], strict=False):
        last_sentence = prev.text.rsplit("Sentence", 1)[1]
        assert nxt.text.startswith("Sentence" + last_sentence)
    assert [c.index for c in chunks] == list(range(len(chunks)))


def test_chunks_never_cross_pages():
    pages = [Page(1, "Page one fact."), Page(2, "Page two fact.")]
    chunks = chunk_pages(pages, words, max_tokens=100, overlap_tokens=10)
    assert [(c.page, c.text) for c in chunks] == [(1, "Page one fact."), (2, "Page two fact.")]


def test_oversized_sentence_is_split():
    long_sentence = " ".join(["word"] * 50) + "."
    chunks = chunk_pages([Page(1, long_sentence)], words, max_tokens=20, overlap_tokens=0)
    assert len(chunks) == 3
    assert all(c.token_count <= 20 for c in chunks)


def test_overlap_must_be_smaller_than_chunk():
    with pytest.raises(ValueError):
        chunk_pages([Page(1, "x.")], words, max_tokens=10, overlap_tokens=10)
