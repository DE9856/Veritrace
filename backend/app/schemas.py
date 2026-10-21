"""Request and response models shared by the API and the agent."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Label = Literal["high", "inferred", "hallucinated"]
NLIVerdict = Literal["entailment", "neutral", "contradiction"]


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
    title: str
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
    safe_mode: bool = Field(
        default=False,
        description="Also return a rewritten answer without the claims flagged as hallucinated.",
    )
    answer: str | None = Field(
        default=None,
        min_length=1,
        max_length=8000,
        description="Check this answer instead of writing one: for answers written by hand, "
        "or by another model.",
    )


class ClaimSignals(BaseModel):
    entailment: float = Field(description="Highest entailment probability across sources.")
    neutral: float = Field(description="Neutral probability for the best-supporting source.")
    contradiction: float = Field(description="Highest contradiction probability across sources.")
    consistency: float | None = Field(
        default=None, description="Share of resampled answers that state the claim."
    )
    retrieval: float = Field(
        default=0.0, description="How closely the supporting passage matches the claim (0-1)."
    )
    self_label: Literal["HIGH", "INFERRED", "UNSURE"] | None = Field(
        default=None, description="The generator's own tag for the sentence."
    )
    judge: Literal["stated", "derivable", "contradicted", "unsupported"] | None = Field(
        default=None, description="Inference judge verdict, for claims NLI could not confirm."
    )
    new_terms: list[str] = Field(
        default_factory=list,
        description="Claim words missing from the supporting passage (a sign of deduction).",
    )


class ClaimResult(BaseModel):
    text: str
    score: float = Field(ge=0, le=1)
    label: Label
    verdict: NLIVerdict
    signals: ClaimSignals
    evidence_label: str | None = Field(
        description="Source label (S1..Sk) that best supports the claim, or that contradicts it."
    )
    evidence_id: str | None
    evidence_cited: bool = Field(
        description="Whether the sentence containing the claim cited that source."
    )
    reason: str


class SentenceResult(BaseModel):
    index: int
    text: str
    label: Label | None = Field(
        description="Label of the weakest claim. None when the sentence has no factual claims."
    )
    claims: list[ClaimResult]


class LabelCounts(BaseModel):
    high: int = 0
    inferred: int = 0
    hallucinated: int = 0


class ChatResponse(BaseModel):
    answer: str
    answer_confidence: float | None = Field(
        description="Claim scores averaged and weighted by claim length. None if no claims."
    )
    counts: LabelCounts
    sentences: list[SentenceResult]
    extraction_fallback: bool = Field(
        description="True if some sentences were checked whole because claim extraction failed."
    )
    cited_labels: list[str] = Field(
        description="Source labels the answer cites, e.g. ['S1', 'S3']."
    )
    invalid_citations: list[str] = Field(
        description="Labels the model cited that were not among the sources it was given."
    )
    sources: list[SourceChunk]
    revised_answer: str | None = Field(
        default=None,
        description="Safe-mode rewrite without the flagged claims; None if not requested or "
        "nothing was flagged.",
    )
    queries: list[str] = Field(default_factory=list, description="Search queries the agent ran.")
    retrieval_attempts: int = 0
    low_coverage: bool = Field(
        default=False,
        description="True if even the best search found only weakly related passages.",
    )
    trace: list[str] = Field(default_factory=list, description="Agent steps, in order.")
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
    nli_model: str
    documents: int
    chunks: int
