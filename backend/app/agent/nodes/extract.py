"""Extract node: splits the answer into sentences, then each sentence into atomic claims."""

import difflib
import re
from dataclasses import dataclass

from pydantic import BaseModel

from app.agent.nodes.generate import SELF_LABEL, strip_self_labels
from app.ingestion.chunker import split_sentences
from app.prompts import render
from app.providers.base import LLMError, LLMProvider

_CITATION_MARKERS = re.compile(r"\s*\[S\d+(?:\s*[,;]\s*S\d+)*\]")
# Citations or a self-label tag that the splitter attached to the start of the next sentence.
_LEADING_MARKERS = re.compile(
    r"^((?:\s*(?:\[S\d+(?:\s*[,;]\s*S\d+)*\]|\{(?:HIGH|INFERRED|UNSURE)\}))+)\s*",
    re.IGNORECASE,
)


@dataclass
class AnswerSentence:
    index: int
    text: str  # as displayed: citations included, self-label tag removed
    plain: str  # citations removed, sent to the extractor
    citations: list[str]
    self_label: str | None = None  # HIGH, INFERRED or UNSURE, if the generator tagged it


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
    """Split a (possibly tagged) answer into sentences with their citations and tag.

    A model sometimes writes "...2023. [S1] {HIGH} Next sentence", and the splitter
    attaches the markers to the next sentence. Move them back to the sentence they follow,
    unless the citation is the subject of the sentence ("[S1] mentions ...")."""
    merged: list[str] = []
    for sentence in split_sentences(answer):
        lead = _LEADING_MARKERS.match(sentence)
        rest = sentence[lead.end() :] if lead else ""
        if merged and lead and (not rest or not rest[0].islower()):
            merged[-1] = f"{merged[-1]} {lead.group(1).strip()}"
            sentence = rest
        if re.search(r"\w", sentence):
            merged.append(sentence.strip())
        elif merged and sentence.strip():  # a lone "." left after moving markers
            merged[-1] = merged[-1] + sentence.strip()

    result = []
    for i, tagged in enumerate(merged):
        tags = SELF_LABEL.findall(tagged)
        text = strip_self_labels(tagged)
        citations = list(
            dict.fromkeys(re.findall(r"S\d+", " ".join(_CITATION_MARKERS.findall(text))))
        )
        plain = re.sub(r"\s+([.,;:!?])", r"\1", _CITATION_MARKERS.sub("", text)).strip()
        label = tags[-1].upper() if tags else None
        result.append(AnswerSentence(i, text, plain, citations, label))
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
    names = NameRepair(" ".join(s.plain for s in sentences))
    claims: list[ExtractedClaim] = []
    used_fallback = False
    for sentence in sentences:
        texts = _clean([names.repair(t) for t in by_index.get(sentence.index, [])])
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
    # "No source addresses X"
    re.compile(
        r"\bno\s+(?:sources?|documents?|passages?)\s+(?:address|mention|state|say|discuss"
        r"|describe|cover|contain|provide)(?:e?s)?\b",
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
    # "No other experiments are mentioned as being performed by X in the provided sources"
    re.compile(
        r"\b(?:no|none|nothing|not)\b[^.]*\b(?:mentioned|stated|specified|listed|reported"
        r"|described|discussed)\b[^.]*\b(?:in|by)\s+" + _SOURCES + r"\s*[.!]?$",
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


_TOKEN_EDGES = re.compile(r"^([\"'(“‘]*)(.*?)((?:['’]s)?[.,;:!?\"')”’]*)$")


class NameRepair:
    """Fixes names the extractor garbles when it repeats them many times.

    Seen live with the 4B model, at temperature 0 and with or without JSON mode:
    "Pragyan" -> "Praginois" / "Prag่าน", "Chandrayaan-2" -> "Chandray-2". A capitalised
    or non-ASCII word that appears nowhere in the answer, starts like a name in the answer
    and closely matches it, is replaced by that name. Candidates come from the whole
    answer because the extractor replaces pronouns ("It also detected...") with names
    from other sentences. Words that appear in the answer are never changed."""

    def __init__(self, answer: str):
        cores = self._cores(answer)
        self._known = {c.lower() for c in cores if c}
        self._names = {
            c.lower(): c
            for c in cores
            if len(c) >= 4 and (c[0].isupper() or any(ch.isdigit() or ch == "-" for ch in c))
        }

    @classmethod
    def _cores(cls, text: str) -> list[str]:
        return [cls._split(token)[1] for token in text.split()]

    @staticmethod
    def _split(token: str) -> tuple[str, str, str]:
        match = _TOKEN_EDGES.match(token)
        return match.groups() if match else ("", token, "")

    def repair(self, claim: str) -> str:
        return re.sub(r"\S+", lambda m: self._fix(m.group(0)), claim)

    def _fix(self, token: str) -> str:
        lead, core, tail = self._split(token)
        if len(core) < 4 or core.lower() in self._known:
            return token
        if not (core[0].isupper() or not core.isascii()):
            return token
        # Garbling keeps the start of the name: "Prag..." for Pragyan, "Chandray..." for
        # Chandrayaan.
        prefix = core[:3].lower()
        candidates = [n for n in self._names if n.startswith(prefix)]
        cutoff = 0.6 if core.isascii() else 0.5
        match = difflib.get_close_matches(core.lower(), candidates, n=1, cutoff=cutoff)
        return f"{lead}{self._names[match[0]]}{tail}" if match else token
