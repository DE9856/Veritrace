"""Ask a question: as one JSON response, or as a Server-Sent Events stream that follows
the agent step by step."""

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from sse_starlette import EventSourceResponse

from app.agent.graph import Agent
from app.providers.base import LLMError
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


def get_agent(request: Request) -> Agent:
    return request.app.state.agent


@router.post("")
async def chat(body: ChatRequest, request: Request) -> ChatResponse:
    try:
        return await get_agent(request).run(body)
    except LLMError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


@router.get("/graph")
def agent_graph(request: Request) -> dict[str, str]:
    """The agent's graph as a Mermaid diagram, generated from the compiled LangGraph."""
    return {"mermaid": get_agent(request).graph.get_graph().draw_mermaid()}


@router.post("/stream")
async def chat_stream(body: ChatRequest, request: Request) -> EventSourceResponse:
    """Events, in order:
    - status   {"node", "message"}   each agent step as it starts
    - draft    {"text"}              the answer so far, while it is being written
    - verdict  ChatResponse          the labelled answer, once
    - error    {"message"}           instead of verdict, if the LLM is unavailable
    """
    agent = get_agent(request)
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def forward(event: dict[str, Any]) -> None:
        await queue.put(event)

    async def run() -> None:
        try:
            response = await agent.run(body, on_event=forward)
            await queue.put({"type": "verdict", "response": response})
        except LLMError as exc:
            await queue.put({"type": "error", "message": str(exc)})
        finally:
            await queue.put(None)

    async def events() -> AsyncIterator[dict[str, str]]:
        task = asyncio.create_task(run())
        try:
            while (event := await queue.get()) is not None:
                kind = event.pop("type")
                if kind == "verdict":
                    data = event["response"].model_dump_json()
                else:
                    data = json.dumps(event)
                yield {"event": kind, "data": data}
        finally:
            # The client went away: stop the agent instead of finishing unseen work.
            if not task.done():
                task.cancel()

    return EventSourceResponse(events())
