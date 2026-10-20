"""Request and response models shared by the API and the agent."""

from datetime import datetime

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: str
    filename: str
    content_type: str
    pages: int
    chunks: int
    size_bytes: int
    created_at: datetime


class SourceChunk(BaseModel):
    """A retrieved chunk, labelled S1..Sk in the order it was shown to the LLM."""

    label: str
    chunk_id: str
    document_id: str
    filename: str
    page: int
    text: str
    similarity: float


class ChunkOut(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    page: int
    chunk_index: int
    text: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_ids: list[str] | None = Field(
        default=None, description="Limit retrieval to these documents. Omit to search all."
    )
    top_k: int | None = Field(default=None, ge=1, le=20)


class ChatResponse(BaseModel):
    answer: str
    cited_labels: list[str] = Field(
        description="Source labels the answer cites, e.g. ['S1', 'S3']."
    )
    invalid_citations: list[str] = Field(
        description="Labels the model cited that were not among the sources it was given."
    )
    sources: list[SourceChunk]
    provider: str
    model: str
    timings_ms: dict[str, int]


class ProviderHealth(BaseModel):
    provider: str
    model: str
    reachable: bool
    model_available: bool
    detail: str | None = None


class HealthOut(BaseModel):
    status: str
    llm: ProviderHealth
    embedding_model: str
    documents: int
    chunks: int
