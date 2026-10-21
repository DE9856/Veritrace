"use client";

import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { useHealth } from "@/hooks/use-health";
import { STEP_NAMES } from "@/lib/labels";
import { cn } from "@/lib/utils";

import { Mark } from "./header";
import { ExampleProof } from "./example-proof";
import { MarkLegend } from "./inspector";
import { ProofMark } from "./proof-mark";
import type { Label } from "@/lib/types";

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
    what: "For claims NLI could not settle, or that use words their passage does not, a second LLM call decides: stated in other words, derivable from the passages, contradicted, or unsupported.",
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
  "A high-confidence claim that adds a quantity its passage does not have (a number, a duration, a comparison) is a deduction: inferred. One that only uses many new words stays high if the judge finds it stated in other words.",
];

// From docs/evaluation.md (0.9.0): the fresh held-out set, written before the 0.9.0 changes and
// never used for tuning.
const EVALUATION = {
  model: "qwen3:4b-instruct",
  claims: 37,
  rows: [
    { name: "Veritrace (all signals)", accuracy: "81%", macroF1: "0.78", halF1: "0.89" },
    { name: "LLM judge alone", accuracy: "70%", macroF1: "0.54", halF1: "0.80" },
    { name: "Self-consistency alone", accuracy: "62%", macroF1: "0.56", halF1: "0.75" },
    { name: "NLI alone", accuracy: "73%", macroF1: "0.61", halF1: "0.85" },
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
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-20 sm:px-6 sm:pt-10">
        <nav className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="group -mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4 transition-transform duration-150 ease-(--ease-out) group-hover:-translate-x-0.5" />
            Back to Veritrace
          </Link>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Mark className="size-[18px]" /> <span className="font-serif text-base">Veritrace</span>
          </span>
        </nav>

        <header className="mt-12 space-y-4 sm:mt-16">
          <h1 className="font-serif text-[2.125rem] leading-[1.05] font-semibold tracking-[-0.022em] sm:text-[3.25rem]">
            How Veritrace checks an answer
          </h1>
          <p className="max-w-[62ch] font-serif text-lg leading-relaxed text-foreground/85">
            Veritrace answers only from the documents you add. It then treats its own answer as untrusted: every
            claim is checked against the source passages, against repeated answers and by a judge, and labelled
            by what the checks found.
          </p>
        </header>

        <div className="mt-14 space-y-14">
          <Section title="The three labels">
            <ExampleProof className="rounded-lg border bg-sheet p-5 sm:p-6" />
            <MarkLegend className="text-sm sm:grid sm:grid-cols-3 sm:gap-6 sm:space-y-0" />
          </Section>

          <Section title="The agent's steps">
            <ol className="divide-y divide-rule border-y border-rule">
              {STEPS.map((step, i) => (
                <li key={step.node} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 py-3 text-[15px]">
                  <span className="text-right text-sm text-pencil tabular-nums">{i + 1}</span>
                  <span>
                    <span className="font-medium">{STEP_NAMES[step.node]}</span>
                    <span className="mt-0.5 block text-muted-foreground">{step.what}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Prose>
              The judge and consistency steps run in parallel. Each step and its time show live above every answer.
            </Prose>
          </Section>

          <Section title="From signals to a label">
            <ScoringPath />
            <Table
              head={["Signal", "Weight", "What it measures"]}
              rows={SIGNALS.map((s) => [s.name, s.weight, s.what])}
              numeric={[1]}
            />
            <Prose>The score is the weighted average of the signals a claim has. Then these rules apply:</Prose>
            <ul className="space-y-2 font-serif text-[1.0625rem] leading-relaxed">
              {RULES.map((rule) => (
                <li key={rule} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2">
                  <span aria-hidden className="mt-[0.7em] size-1 rounded-full bg-foreground/50" />
                  {rule}
                </li>
              ))}
            </ul>
            <Prose>
              A sentence takes the label of its weakest claim. The answer&apos;s confidence is the average claim
              score, weighted by claim length. Weights and thresholds are in <Code>backend/config.yaml</Code>.
            </Prose>
          </Section>

          <Section title="Models">
            <Table head={["Role", "Model"]} rows={models.map((m) => [m.role, m.name])} />
            <Prose>
              The main model is Groq&apos;s gpt-oss-120b, with Gemini as fallback when Groq is rate limited.
              Everything also runs offline on qwen3:4b-instruct through Ollama.
            </Prose>
          </Section>

          <Section title="How well it works">
            <Prose>
              Measured on {EVALUATION.claims} hand-labelled claims the rules were never tuned on, with{" "}
              {EVALUATION.model}. Hallucination F1 is how well it finds the hallucinated claims.
            </Prose>
            <Table
              head={["Method", "Accuracy", "Macro-F1", "Hallucination F1"]}
              rows={EVALUATION.rows.map((r) => [r.name, r.accuracy, r.macroF1, r.halF1])}
              numeric={[1, 2, 3]}
              emphasise={0}
            />
            <Prose>
              It catches all 12 hallucinated claims and never calls a claim the documents state hallucinated. The
              judge and self-consistency baselines cannot say inferred at all. Its most common mistake is calling a
              deduction hallucinated: the small judge sometimes reads approximate arithmetic as a contradiction.
              Full results, with an ablation of each signal:{" "}
              <Code>docs/evaluation.md</Code>.
            </Prose>
            <Prose>
              The score is not itself a probability: claims scored 0.6 to 0.9 turned out supported almost every time.
              So each claim also shows a calibrated chance of being supported, fitted on the dev claims (Platt
              scaling). On the fresh claims it roughly halves the calibration error, from 0.15 to 0.08. Showing only the
              claims with at least a 50% chance would have hidden all 12 hallucinations and 2 of the 25 supported
              claims.
            </Prose>
            <Prose>
              To test it on more hallucinations than anyone would label by hand, true claims had one fact changed by
              fixed rules: a date moved, a number changed, a name swapped, a negation flipped. It catches 80 of the 86
              and flags none of the 85 unchanged claims. Swapped names are the hardest: 28 of 34.
            </Prose>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl font-semibold tracking-[-0.012em]">{title}</h2>
      {children}
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[65ch] font-serif text-[1.0625rem] leading-relaxed text-foreground/85">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-[0.8em] text-foreground">{children}</code>;
}

function Table({
  head,
  rows,
  numeric = [],
  emphasise,
}: {
  head: string[];
  rows: string[][];
  numeric?: number[];
  emphasise?: number; // index of a row to set in medium weight
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-sheet">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[13px] text-muted-foreground">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn("px-4 py-2.5 font-medium whitespace-nowrap", numeric.includes(i) && "text-right")}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={row[0]} className={cn("border-b border-rule last:border-0", r === emphasise && "font-medium")}>
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-4 py-2.5 align-top",
                    numeric.includes(i) && "text-right whitespace-nowrap tabular-nums",
                    i === 0 && "whitespace-nowrap",
                  )}
                >
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

// The path in backend/config.yaml, summarised: thresholds are high 0.75, inferred 0.45,
// contradiction 0.7 and strong entailment 0.85, as the rules below spell out in full.
const PATH_RULES: { when: string; label: Label }[] = [
  { when: "The judge says contradicted, or NLI contradiction is 0.7 or more", label: "hallucinated" },
  { when: "No passage supports it (entailment under 0.45) and the judge cannot derive it", label: "hallucinated" },
  { when: "Score 0.75 or more, or entailment 0.85 or more with the resamples agreeing", label: "high" },
  { when: "Anything else supported, and any high claim that adds new numbers or words", label: "inferred" },
];

/** Signals, weighted into a score, then rules, then a label: the scoring path at a glance. */
function ScoringPath() {
  return (
    <figure className="rounded-lg border bg-sheet p-5 sm:p-6">
      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1.5fr)]">
        <div className="space-y-2.5">
          <p className="text-[13px] font-medium text-muted-foreground">Signals, by weight</p>
          {SIGNALS.map((signal) => (
            <div key={signal.name} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-[13px]">
              <span>{signal.name}</span>
              <span className="h-1.5 rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-pencil"
                  style={{ width: `${(Number(signal.weight) / 0.65) * 100}%` }}
                />
              </span>
              <span className="text-right text-muted-foreground tabular-nums">{signal.weight}</span>
            </div>
          ))}
        </div>
        <Arrow />
        <div className="rounded-md bg-pencil-soft px-4 py-3 text-center">
          <p className="font-serif text-2xl leading-none font-semibold text-pencil">0–100</p>
          <p className="mt-1 text-xs text-muted-foreground">weighted score</p>
        </div>
        <Arrow />
        <ul className="divide-y divide-rule border-l-[3px] border-double border-pencil/45 pl-4">
          {PATH_RULES.map((rule) => (
            <li key={rule.when} className="flex items-start justify-between gap-3 py-2 text-[13px] first:pt-0 last:pb-0">
              <span className="text-foreground/85">{rule.when}</span>
              <ProofMark label={rule.label} className="mt-0.5" />
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-4 text-xs text-muted-foreground">
        A summary of the path; the table and rules below give it in full.
      </figcaption>
    </figure>
  );
}

function Arrow() {
  return (
    <span className="flex justify-center text-pencil/70" aria-hidden>
      <ArrowDownIcon className="size-4 md:hidden" />
      <ArrowRightIcon className="hidden size-4 md:block" />
    </span>
  );
}
