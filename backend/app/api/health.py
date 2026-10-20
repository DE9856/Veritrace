from fastapi import APIRouter

from app.api.deps import ServicesDep
from app.schemas import HealthOut

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health(services: ServicesDep) -> HealthOut:
    llm = await services.provider.health()
    return HealthOut(
        status="ok" if llm.reachable and llm.model_available else "degraded",
        llm=llm,
        embedding_model=services.embedder.model_name,
        documents=services.documents.count(),
        chunks=services.store.count(),
    )
