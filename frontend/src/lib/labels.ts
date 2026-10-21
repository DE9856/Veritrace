import type { Label } from "./types";

export const LABEL_TEXT: Record<Label, string> = {
  high: "High confidence",
  inferred: "Inferred",
  hallucinated: "Possibly hallucinated",
};

export const LABEL_HINT: Record<Label, string> = {
  high: "A source passage states this.",
  inferred: "Follows from the sources, but no passage says it directly.",
  hallucinated: "Contradicted by the sources, or not supported by them.",
};

/** Tailwind classes for a small label pill. */
export const LABEL_PILL: Record<Label, string> = {
  high: "bg-high-soft text-high",
  inferred: "bg-inferred-soft text-inferred",
  hallucinated: "bg-halluc-soft text-halluc",
};

export const LABEL_BAR: Record<Label, string> = {
  high: "bg-high",
  inferred: "bg-inferred",
  hallucinated: "bg-halluc",
};

/** The agent's graph nodes, in the order a normal run visits them, with short names. */
export const STEP_NAMES: Record<string, string> = {
  analyze: "Plan search",
  retrieve: "Search documents",
  no_sources: "No documents",
  generate: "Write answer",
  extract: "Split into claims",
  verify: "Check against sources",
  judge: "Judge unsettled claims",
  consistency: "Compare resamples",
  score: "Score confidence",
  revise: "Safe rewrite",
};

export const percent = (value: number) => `${Math.round(value * 100)}`;

export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

// The cut-offs the backend clamps scores to (backend/config.yaml): a flagged claim scores below
// 0.45, an inferred one 0.45 to 0.74, a high-confidence one 0.75 or more.
export const INFERRED_CUTOFF = 0.45;
export const HIGH_CUTOFF = 0.75;

/** Every claim in an answer gets one number, in reading order, used wherever the claim appears:
 *  after its sentence, on the threshold scale, in the claim list and in the claim panel. */
export function numberClaims<S extends { index: number; claims: unknown[] }>(sentences: S[]) {
  const numbers = new Map<number, number[]>();
  let n = 0;
  for (const sentence of sentences) numbers.set(sentence.index, sentence.claims.map(() => ++n));
  return numbers;
}
