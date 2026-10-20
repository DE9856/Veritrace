"""Ask a question. Phase 1 returns plain JSON; Phase 4 switches this to an SSE stream."""

from fastapi import APIRouter, HTTPException, status

from app.agent.pipeline import answer_question
from app.api.deps import ServicesDep
from app.providers.base import LLMError
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
async def chat(request: ChatRequest, services: ServicesDep) -> ChatResponse:
    try:
        return await answer_question(
            request,
            provider=services.provider,
            embedder=services.embedder,
            store=services.store,
            default_k=services.settings.top_k,
        )
    except LLMError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
