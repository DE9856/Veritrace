"""Extract node: splits the answer into sentences, then each sentence into atomic claims."""

import re
from dataclasses import dataclass

from pydantic import BaseModel

from app.ingestion.chunker import split_sentences
from app.prompts import render
from app.providers.base import LLMError, LLMProvider

_CITATION_MARKERS = re.compile(r"\s*\[S\d+(?:\s*[,;]\s*S\d+)*\]")
_LEADING_MARKERS = re.compile(r"^((?:\s*\[S\d+(?:\s*[,;]\s*S\d+)*\])+)\s*")


@dataclass
class AnswerSentence:
    index: int
    text: str  # as displayed, citations included
    plain: str  # citations removed, sent to the extractor
    citations: list[str]


@dataclass
class ExtractedClaim:
    sentence_index: int
    text: str


class _SentenceClaims(BaseModel):
    index: int
    claims: list[str]


class _Extraction(BaseModel):
    sentences: list[_SentenceClaims]


def split_answer(answer: str) -> list[AnswerSentence]:
    # A model sometimes writes "...2023. [S1] Next sentence", and the splitter attaches
    # "[S1]" to the next sentence. Move leading markers back to the sentence they follow.
    merged: list[str] = []
    for sentence in split_sentences(answer):
        lead = _LEADING_MARKERS.match(sentence)
        if merged and lead:
            merged[-1] = f"{merged[-1]} {lead.group(1).strip()}"
            sentence = sentence[lead.end() :]
        if sentence.strip():
            merged.append(sentence.strip())

    result = []
    for i, text in enumerate(merged):
        citations = list(
            dict.fromkeys(re.findall(r"S\d+", " ".join(_CITATION_MARKERS.findall(text))))
        )
        plain = re.sub(r"\s+([.,;:!?])", r"\1", _CITATION_MARKERS.sub("", text)).strip()
        result.append(AnswerSentence(i, text, plain, citations))
    return result


async def extract_claims(
    question: str, sentences: list[AnswerSentence], *, provider: LLMProvider
) -> tuple[list[ExtractedClaim], bool]:
    """Return the claims and whether the fallback (one claim per sentence) was used."""
    if not sentences:
        return [], False
    try:
        extraction = await provider.generate_json(
            render(
                "extract_user",
                question=question,
                sentences="\n".join(f"{s.index}: {s.plain}" for s in sentences),
            ),
            _Extraction,
            system=render("extract_system"),
        )
    except LLMError:
        # Never skip verification because extraction failed: check whole sentences instead.
        whole = [
            ExtractedClaim(s.index, s.plain) for s in sentences if not is_about_sources(s.plain)
        ]
        return whole, True

    by_index = {entry.index: entry.claims for entry in extraction.sentences}
    claims: list[ExtractedClaim] = []
    used_fallback = False
    for sentence in sentences:
        texts = _clean(by_index.get(sentence.index, []))
        if not texts and sentence.citations and not is_about_sources(sentence.plain):
            # A sentence that cites a source makes a factual claim. If the extractor
            # returned nothing for it, check the whole sentence rather than skip it.
            texts = [sentence.plain]
            used_fallback = True
        claims.extend(ExtractedClaim(sentence.index, t) for t in texts)
    return claims, used_fallback


_SOURCES = r"(?:the\s+)?(?:provided\s+|given\s+)?(?:documents?|sources?|passages?|context)"
_ABOUT_SOURCES = [
    # "The documents do not mention ...", "The sources don't say ..."
    re.compile(
        _SOURCES + r"\s+(?:do|does|did)(?:\s+not|n['’]t)\s+(?:contain|mention|say|state|specify"
        r"|provide|include|cover|give|discuss|describe|address|explain)\b",
        re.IGNORECASE,
    ),
    # "There is no information about X in the documents"
    re.compile(
        r"\bno\s+(?:information|details?|mention|data)\b[^.]*\b(?:in|from)\s+" + _SOURCES,
        re.IGNORECASE,
    ),
    # "X is not mentioned in the sources"
    re.compile(
        r"\bnot\s+(?:mentioned|stated|specified|covered|provided|discussed|described)\s+"
        r"(?:in|by)\s+" + _SOURCES,
        re.IGNORECASE,
    ),
]


def is_about_sources(text: str) -> bool:
    """True for statements about what the sources do not cover. They say nothing about
    the world, so there is nothing to verify."""
    return any(p.search(text) for p in _ABOUT_SOURCES)


def _clean(texts: list[str]) -> list[str]:
    seen: list[str] = []
    for text in texts:
        text = _CITATION_MARKERS.sub("", text).strip()
        if text and text not in seen and not is_about_sources(text):
            seen.append(text)
    return seen
