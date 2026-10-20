"""Entry point for answering a question; the work is done by the agent graph (graph.py)."""

from app.agent.graph import EMPTY_KB_ANSWER, NO_MATCH_ANSWER, Agent, EventHandler
from app.schemas import ChatRequest, ChatResponse
from app.services import Services

__all__ = ["EMPTY_KB_ANSWER", "NO_MATCH_ANSWER", "answer_question"]


async def answer_question(
    request: ChatRequest, services: Services, on_event: EventHandler | None = None
) -> ChatResponse:
    return await Agent(services).run(request, on_event)
