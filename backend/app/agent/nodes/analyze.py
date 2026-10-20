"""Analyze node: plans the search queries, and rewrites them when the last search found
only weak evidence."""

from pydantic import BaseModel, Field

from app.prompts import render
from app.providers.base import LLMError, LLMProvider

MAX_QUERIES = 3


class _SearchPlan(BaseModel):
    queries: list[str] = Field(json_schema_extra={"maxItems": MAX_QUERIES})


async def plan_queries(
    question: str,
    *,
    provider: LLMProvider,
    previous: list[str] | None = None,
    best_similarity: float | None = None,
) -> list[str]:
    """Search queries for the question. On a retry, `previous` holds the queries that
    found only weak evidence, and the model is asked for different wording."""
    feedback = ""
    if previous:
        tried = "; ".join(f'"{q}"' for q in previous)
        feedback = (
            f"\nThese queries found only weakly related passages (best match "
            f"{best_similarity:.2f}): {tried}. Write different queries: other terms, "
            "likely names or technical words, or a narrower focus.\n"
        )
    try:
        plan = await provider.generate_json(
            render("analyze_user", question=question, feedback=feedback),
            _SearchPlan,
            system=render("analyze_system"),
        )
        planned = [q.strip() for q in plan.queries if q.strip()]
    except LLMError:
        planned = []

    # The question itself is always searched on the first pass; on a retry only new
    # wordings are worth running.
    seen = {q.lower() for q in previous or []}
    queries = [] if previous else [question]
    for q in planned:
        if q.lower() not in seen and q.lower() not in {x.lower() for x in queries}:
            queries.append(q)
    return queries[: MAX_QUERIES + 1] or [question]
