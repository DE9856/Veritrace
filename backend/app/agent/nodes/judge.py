"""Judge node: decides whether claims that NLI could not confirm are reasonable
deductions from the evidence, contradicted by it, or unsupported.

NLI only recognises claims a single passage states. Conclusions drawn from several
passages, or approximate arithmetic on stated dates ("about two weeks"), come back
neutral or even as contradictions. The judge sees all the evidence at once and
separates deductions from invented or wrong facts.
"""

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

from app.agent.nodes.generate import format_sources
from app.prompts import render
from app.providers.base import LLMError, LLMProvider
from app.schemas import SourceChunk

JudgeVerdict = Literal["derivable", "contradicted", "unsupported"]


class _Item(BaseModel):
    id: int
    verdict: JudgeVerdict
    # The model ignores "at most 15 words" in the prompt, and long reasons made the judge
    # slow. maxLength goes into the JSON grammar Ollama decodes with; it is not validated
    # here, so a provider that ignores it cannot make the whole judgement fail.
    reason: str = Field(json_schema_extra={"maxLength": 120})


class _Judgement(BaseModel):
    claims: list[_Item]


@dataclass
class Judgement:
    verdict: JudgeVerdict
    reason: str


async def judge_claims(
    claims: dict[int, str], sources: list[SourceChunk], *, provider: LLMProvider
) -> dict[int, Judgement]:
    """Judge the given claims (keyed by claim index) in one LLM call.

    Returns an empty dict if the call fails, so scoring falls back to the other signals."""
    if not claims:
        return {}
    try:
        result = await provider.generate_json(
            render(
                "judge_user",
                sources=format_sources(sources),
                claims="\n".join(f"{i}: {text}" for i, text in claims.items()),
            ),
            _Judgement,
            system=render("judge_system"),
        )
    except LLMError:
        return {}
    return {
        item.id: Judgement(item.verdict, item.reason.strip())
        for item in result.claims
        if item.id in claims
    }
