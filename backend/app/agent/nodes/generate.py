"""Generate node: writes a grounded answer that cites the source labels it relies on."""

import re
from dataclasses import dataclass

from app.prompts import render
from app.providers.base import LLMProvider
from app.schemas import SourceChunk

# Matches [S1], [S2, S4] and [S2; S4].
_CITATION = re.compile(r"\[(S\d+(?:\s*[,;]\s*S\d+)*)\]")
# The generator's own confidence tag after each sentence: {HIGH}, {INFERRED} or {UNSURE}.
SELF_LABEL = re.compile(r"\s*\{(HIGH|INFERRED|UNSURE)\}", re.IGNORECASE)


@dataclass
class GeneratedAnswer:
    answer: str  # self-label tags removed, as shown to the user
    tagged: str  # raw model output, tags included
    cited_labels: list[str]
    invalid_citations: list[str]


def strip_self_labels(text: str) -> str:
    return re.sub(r"[ \t]+([.,;:!?])", r"\1", SELF_LABEL.sub("", text)).strip()


def format_sources(sources: list[SourceChunk]) -> str:
    return "\n\n".join(
        f"[{s.label}] ({s.title}; {s.filename}, page {s.page})\n{s.text}" for s in sources
    )


def extract_citations(answer: str, valid_labels: set[str]) -> tuple[list[str], list[str]]:
    """Return (cited, invalid) labels in first-seen order."""
    seen: list[str] = []
    for group in _CITATION.findall(answer):
        for label in re.split(r"\s*[,;]\s*", group):
            if label not in seen:
                seen.append(label)
    cited = [label for label in seen if label in valid_labels]
    invalid = [label for label in seen if label not in valid_labels]
    return cited, invalid


async def generate(
    question: str, sources: list[SourceChunk], *, provider: LLMProvider
) -> GeneratedAnswer:
    tagged = await provider.generate(
        render("generate_user", sources=format_sources(sources), question=question),
        system=render("generate_system"),
    )
    answer = strip_self_labels(tagged)
    cited, invalid = extract_citations(answer, {s.label for s in sources})
    return GeneratedAnswer(
        answer=answer, tagged=tagged, cited_labels=cited, invalid_citations=invalid
    )
