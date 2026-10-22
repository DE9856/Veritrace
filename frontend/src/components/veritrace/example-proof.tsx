"use client";

import type { ClaimResult, Label, SentenceResult } from "@/lib/types";
import { cn } from "@/lib/utils";

import { HighlightedAnswer } from "./highlighted-answer";
import { VerdictScale } from "./verdict-scale";

// An illustration of how a proof is marked, written against the Chandrayaan-3 sample document
// (public/samples/chandrayaan-3.md). It is not a checked answer, and the page says so.
const claim = (text: string, label: Label, score: number): ClaimResult => ({
  text,
  label,
  score,
  support_probability: 1 / (1 + Math.exp(-(6.27 * score - 2.07))), // the backend's calibration
  verdict: label === "hallucinated" ? "contradiction" : "entailment",
  evidence_label: "S1",
  evidence_id: null,
  evidence_cited: true,
  reason: "",
  signals: {
    entailment: 0,
    neutral: 0,
    contradiction: 0,
    consistency: null,
    retrieval: 0,
    self_label: null,
    judge: null,
    new_terms: [],
  },
});

const sentence = (index: number, text: string, label: Label, score: number): SentenceResult => ({
  index,
  text,
  label,
  claims: [claim(text, label, score)],
});

export const EXAMPLE: SentenceResult[] = [
  sentence(0, "The Vikram lander touched down near the lunar south pole on 23 August 2023 [S1].", "high", 0.98),
  sentence(1, "Its rover confirmed sulphur in the lunar surface [S1].", "high", 0.95),
  sentence(2, "The rover stopped working because the lunar night left it without sunlight [S1].", "inferred", 0.66),
  sentence(3, "The mission was launched aboard a PSLV rocket [S1].", "hallucinated", 0.06),
];

/** A labelled specimen of a checked answer, for the welcome screen, the empty claim panel and the
 *  explainer page: the marked text and its claims on the threshold scale. */
export function ExampleProof({ className }: { className?: string }) {
  return (
    <figure className={cn("space-y-5", className)}>
      <HighlightedAnswer sentences={EXAMPLE} interactive={false} className="text-[1rem] leading-[1.75] sm:text-[1.0625rem]" />
      <VerdictScale
        claims={EXAMPLE.map((s, i) => ({ n: i + 1, sentence: s.index, label: s.label!, score: s.claims[0].score }))}
        confidence={null}
        animate={false}
      />
      <figcaption className="text-xs leading-relaxed text-muted-foreground">
        An illustration written against the Chandrayaan-3 sample, not a checked answer. The sample says the
        mission flew on an LVM3, so the last sentence is flagged.
      </figcaption>
    </figure>
  );
}
