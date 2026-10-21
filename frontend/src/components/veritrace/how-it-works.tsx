"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { useHealth } from "@/hooks/use-health";
import { LABEL_BAR, LABEL_HINT, LABEL_TEXT, STEP_NAMES } from "@/lib/labels";
import type { Label } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS: { node: string; what: string }[] = [
  { node: "analyze", what: "Rewrites the question into search queries." },
  {
    node: "retrieve",
    what: "Finds the closest passages in your documents. If they match weakly, the agent rewrites the queries and searches again (up to twice).",
  },
  {
    node: "generate",
    what: "Writes the answer from the passages only, citing them as [S1], [S2], and tags each sentence HIGH, INFERRED or UNSURE.",
  },
  { node: "extract", what: "Splits the answer into short, self-contained factual claims." },
  {
    node: "verify",
    what: "An NLI model reads each claim against each passage: does the passage entail it, contradict it, or neither?",
  },
  {
    node: "judge",
    what: "For claims NLI could not settle, a second LLM call decides: derivable from the passages, contradicted, or unsupported.",
  },
  {
    node: "consistency",
    what: "Asks the question again a few times at a higher temperature; a claim the other answers do not repeat is suspect.",
  },
  { node: "score", what: "Combines the signals into a score and a label for every claim." },
  { node: "revise", what: "In safe mode, rewrites the answer without the claims flagged as hallucinated." },
];

const SIGNALS: { name: string; weight: string; what: string }[] = [
  { name: "Entailment", weight: "0.65", what: "How strongly the best passage supports the claim (NLI)." },
  { name: "Consistency", weight: "0.15", what: "Share of resampled answers that also state it." },
  { name: "Passage match", weight: "0.10", what: "How closely the supporting passage matches the claim." },
  { name: "Self-label", weight: "0.10", what: "The writer's own tag: HIGH 1.0, INFERRED 0.5, UNSURE 0.2." },
];

const RULES = [
  "A judge verdict of contradicted, or a strong NLI contradiction, makes a claim hallucinated.",
  "A claim no passage supports (entailment below 0.45) is hallucinated, unless the judge finds it derivable from the passages: then it is inferred.",
  "A supported claim is high confidence if its score is 0.75 or more, or if entailment is at least 0.85 and the resampled answers agree. Otherwise it is inferred.",
  "A high-confidence claim that adds a new number, or many words its passage does not use, is a deduction: inferred.",
];

// From docs/evaluation.md (2026-10-21): held-out test set, never used for tuning.
const EVALUATION = {
  model: "qwen3:4b-instruct",
  claims: 67,
  rows: [
    { name: "Veritrace (all signals)", accuracy: "75%", macroF1: "0.76", halF1: "0.93" },
    { name: "LLM judge alone", accuracy: "81%", macroF1: "0.59", halF1: "0.88" },
    { name: "Self-consistency alone", accuracy: "70%", macroF1: "0.51", halF1: "0.74" },
    { name: "NLI alone", accuracy: "76%", macroF1: "0.60", halF1: "0.81" },
  ],
};

export function HowItWorks() {
  const { health } = useHealth();
  const models = [
    { role: "Writes, judges and resamples", name: health ? `${health.llm.model} (${health.llm.provider})` : "…" },
    { role: "Finds passages (embeddings)", name: health?.embedding_model ?? "…" },
    { role: "Checks claims (NLI)", name: health?.nli_model ?? "…" },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-6 sm:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" /> Back to Veritrace
        </Link>

        <header className="space-y-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">How Veritrace checks an answer</h1>
          <p className="max-w-[65ch] text-muted-foreground">
            Veritrace answers only from the documents you add. It then treats its own answer as untrusted: every
            claim is checked against the source passages, against repeated answers and by a judge, and labelled
            by what the checks found.
          </p>
        </header>

        <Section title="The three labels">
          <ul className="grid gap-3 sm:grid-cols-3">
            {(["high", "inferred", "hallucinated"] as Label[]).map((label) => (
              <li key={label} className="rounded-lg border bg-card p-3">
                <div className={cn("mb-2 h-1 w-8 rounded-full", LABEL_BAR[label])} />
                <p className="text-sm font-medium">{LABEL_TEXT[label]}</p>
                <p className="text-sm text-muted-foreground">{LABEL_HINT[label]}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="The agent's steps">
          <ol className="space-y-2">
            {STEPS.map((step, i) => (
              <li key={step.node} className="flex gap-3 text-sm">
                <span className="w-5 shrink-0 text-right font-mono text-muted-foreground">{i + 1}</span>
                <span>
                  <span className="font-medium">{STEP_NAMES[step.node]}</span>
                  <span className="text-muted-foreground"> · {step.what}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            The judge and consistency steps run in parallel. Each step and its time show live above every answer.
          </p>
        </Section>

        <Section title="From signals to a label">
          <Table
            head={["Signal", "Weight", "What it measures"]}
            rows={SIGNALS.map((s) => [s.name, s.weight, s.what])}
          />
          <p className="text-sm text-muted-foreground">
            The score is the weighted average of the signals a claim has. Then these rules apply:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            A sentence takes the label of its weakest claim. The answer&apos;s confidence is the average claim
            score, weighted by claim length. Weights and thresholds are in <code>backend/config.yaml</code>.
          </p>
        </Section>

        <Section title="Models">
          <Table head={["Role", "Model"]} rows={models.map((m) => [m.role, m.name])} mono={1} />
          <p className="text-sm text-muted-foreground">
            The main model is Groq&apos;s gpt-oss-120b, with Gemini as fallback when Groq is rate limited.
            Everything also runs offline on qwen3:4b-instruct through Ollama.
          </p>
        </Section>

        <Section title="How well it works">
          <p className="text-sm text-muted-foreground">
            Measured on {EVALUATION.claims} hand-labelled claims the rules were never tuned on, with{" "}
            <span className="font-mono">{EVALUATION.model}</span>. Hallucination F1 is how well it finds the
            hallucinated claims.
          </p>
          <Table
            head={["Method", "Accuracy", "Macro-F1", "Hallucination F1"]}
            rows={EVALUATION.rows.map((r) => [r.name, r.accuracy, r.macroF1, r.halF1])}
          />
          <p className="text-sm text-muted-foreground">
            It catches 14 of the 15 hallucinated claims and never calls a claim the documents state
            hallucinated. The judge and self-consistency baselines cannot say inferred at all. Its most common
            mistake is labelling a correct paraphrase inferred. Full results, with an ablation of each signal: <code>docs/evaluation.md</code>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows, mono }: { head: string[]; rows: string[][]; mono?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b last:border-0">
              {row.map((cell, i) => (
                <td key={i} className={cn("px-3 py-2 align-top", i === mono && "font-mono text-xs")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
