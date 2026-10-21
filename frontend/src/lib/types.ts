// Mirrors backend/app/schemas.py. Keep the two in sync.

export type Label = "high" | "inferred" | "hallucinated";
export type SelfLabel = "HIGH" | "INFERRED" | "UNSURE";
export type JudgeVerdict = "stated" | "derivable" | "contradicted" | "unsupported";

export interface DocumentInfo {
  id: string;
  filename: string;
  content_type: string;
  pages: number;
  chunks: number;
  size_bytes: number;
  created_at: string;
}

export interface SourceChunk {
  label: string; // S1..Sk
  chunk_id: string;
  document_id: string;
  filename: string;
  title: string;
  page: number;
  text: string;
  similarity: number;
}

export interface ClaimSignals {
  entailment: number;
  neutral: number;
  contradiction: number;
  consistency: number | null;
  retrieval: number;
  self_label: SelfLabel | null;
  judge: JudgeVerdict | null;
  new_terms: string[];
}

export interface ClaimResult {
  text: string;
  score: number;
  label: Label;
  verdict: "entailment" | "neutral" | "contradiction";
  signals: ClaimSignals;
  evidence_label: string | null;
  evidence_id: string | null;
  evidence_cited: boolean;
  reason: string;
}

export interface SentenceResult {
  index: number;
  text: string;
  label: Label | null;
  claims: ClaimResult[];
}

export interface LabelCounts {
  high: number;
  inferred: number;
  hallucinated: number;
}

export interface ChatResponse {
  answer: string;
  answer_confidence: number | null;
  counts: LabelCounts;
  sentences: SentenceResult[];
  extraction_fallback: boolean;
  cited_labels: string[];
  invalid_citations: string[];
  sources: SourceChunk[];
  revised_answer: string | null;
  queries: string[];
  retrieval_attempts: number;
  low_coverage: boolean;
  trace: string[];
  provider: string;
  model: string;
  timings_ms: Record<string, number>;
}

export interface ChatRequest {
  question: string;
  safe_mode?: boolean;
  document_ids?: string[];
  answer?: string; // check this answer instead of writing one
}

export interface Health {
  status: "ok" | "degraded";
  llm: {
    provider: string;
    model: string;
    reachable: boolean;
    model_available: boolean;
    detail: string | null;
  };
  embedding_model: string;
  nli_model: string;
  documents: number;
  chunks: number;
}

export interface StatusEvent {
  node: string;
  message: string;
}
