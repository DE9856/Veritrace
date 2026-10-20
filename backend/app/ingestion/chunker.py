"""Groups sentences into overlapping, token-bounded chunks.

Chunks never cross a page boundary, so every citation points at exactly one page.
"""

from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache

import pysbd

from app.ingestion.parser import Page

TokenCounter = Callable[[str], int]


@dataclass
class Chunk:
    page: int
    index: int  # position within the document
    text: str
    token_count: int


@lru_cache
def _segmenter() -> pysbd.Segmenter:
    return pysbd.Segmenter(language="en", clean=False)


def split_sentences(text: str) -> list[str]:
    sentences: list[str] = []
    for paragraph in text.split("\n\n"):
        sentences.extend(s.strip() for s in _segmenter().segment(paragraph) if s.strip())
    return sentences


def _split_long(sentence: str, count: TokenCounter, max_tokens: int) -> list[str]:
    """Break a sentence longer than max_tokens into word windows (tables, run-on text)."""
    pieces, current = [], []
    for word in sentence.split():
        if current and count(" ".join([*current, word])) > max_tokens:
            pieces.append(" ".join(current))
            current = []
        current.append(word)
    if current:
        pieces.append(" ".join(current))
    return pieces


def chunk_pages(
    pages: list[Page], count: TokenCounter, max_tokens: int, overlap_tokens: int
) -> list[Chunk]:
    if overlap_tokens >= max_tokens:
        raise ValueError("overlap_tokens must be smaller than max_tokens")

    chunks: list[Chunk] = []
    for page in pages:
        units: list[tuple[str, int]] = []
        for sentence in split_sentences(page.text):
            n = count(sentence)
            if n > max_tokens:
                units.extend((p, count(p)) for p in _split_long(sentence, count, max_tokens))
            else:
                units.append((sentence, n))

        window: list[tuple[str, int]] = []
        window_tokens = 0
        for text, n in units:
            if window and window_tokens + n > max_tokens:
                chunks.append(_make_chunk(page.number, len(chunks), window))
                # Carry trailing sentences into the next chunk as overlap.
                carried: list[tuple[str, int]] = []
                carried_tokens = 0
                for prev in reversed(window):
                    if carried_tokens + prev[1] > overlap_tokens:
                        break
                    carried.insert(0, prev)
                    carried_tokens += prev[1]
                if carried_tokens + n > max_tokens:
                    carried, carried_tokens = [], 0
                window, window_tokens = carried, carried_tokens
            window.append((text, n))
            window_tokens += n
        if window:
            chunks.append(_make_chunk(page.number, len(chunks), window))
    return chunks


def _make_chunk(page: int, index: int, window: list[tuple[str, int]]) -> Chunk:
    return Chunk(
        page=page,
        index=index,
        text=" ".join(t for t, _ in window),
        token_count=sum(n for _, n in window),
    )
