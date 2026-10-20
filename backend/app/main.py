"""FastAPI entry point. Run with: uvicorn app.main:app --reload"""

from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent.graph import Agent
from app.api import chat, chunks, documents, health
from app.config import Settings, get_settings
from app.ingestion.library import seed_samples
from app.services import Services, build_services


def create_app(
    settings: Settings | None = None,
    services_factory: Callable[[Settings], Services] = build_services,
) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Loads the embedding model and opens the stores once, before the first request.
        app.state.services = services_factory(settings)
        app.state.agent = Agent(app.state.services)
        if settings.seed_samples:
            seed_samples(app.state.services)
        yield

    app = FastAPI(title="Veritrace API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for module in (documents, chunks, chat, health):
        app.include_router(module.router)
    return app


app = create_app()
