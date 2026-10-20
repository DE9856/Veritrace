"""Generate node: writes a grounded answer that cites the source labels it relies on."""

import re
from collections.abc import Callable
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


def visible_draft(partial: str) -> str:
    """The answer so far as the user should see it: complete tags removed, and a tag
    still being written ("{HIG") hidden until it is complete."""
    return strip_self_labels(re.sub(r"\{[A-Za-z]*$", "", partial))


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
    question: str,
    sources: list[SourceChunk],
    *,
    provider: LLMProvider,
    on_draft: Callable[[str], None] | None = None,
) -> GeneratedAnswer:
    """Write the answer. With `on_draft`, the answer is streamed and the callback gets
    the visible text so far after every piece."""
    prompt = render("generate_user", sources=format_sources(sources), question=question)
    system = render("generate_system")
    if on_draft is None:
        tagged = await provider.generate(prompt, system=system)
    else:
        pieces: list[str] = []
        async for piece in provider.stream(prompt, system=system):
            pieces.append(piece)
            on_draft(visible_draft("".join(pieces)))
        tagged = "".join(pieces).strip()
    answer = strip_self_labels(tagged)
    cited, invalid = extract_citations(answer, {s.label for s in sources})
    return GeneratedAnswer(
        answer=answer, tagged=tagged, cited_labels=cited, invalid_citations=invalid
    )
