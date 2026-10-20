"""Generate node: writes a grounded answer that cites the source labels it relies on."""

import re
from dataclasses import dataclass

from app.prompts import render
from app.providers.base import LLMProvider
from app.schemas import SourceChunk

# Matches [S1], [S2, S4] and [S2; S4].
_CITATION = re.compile(r"\[(S\d+(?:\s*[,;]\s*S\d+)*)\]")


@dataclass
class GeneratedAnswer:
    answer: str
    cited_labels: list[str]
    invalid_citations: list[str]


def format_sources(sources: list[SourceChunk]) -> str:
    return "\n\n".join(f"[{s.label}] ({s.filename}, page {s.page})\n{s.text}" for s in sources)


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
    answer = await provider.generate(
        render("generate_user", sources=format_sources(sources), question=question),
        system=render("generate_system"),
    )
    cited, invalid = extract_citations(answer, {s.label for s in sources})
    return GeneratedAnswer(answer=answer, cited_labels=cited, invalid_citations=invalid)
