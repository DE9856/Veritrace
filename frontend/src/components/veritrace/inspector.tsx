"use client";

import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { bestSentence } from "@/lib/evidence";
import { LABEL_HINT, LABEL_TEXT, percent } from "@/lib/labels";
import type { ChatResponse, ClaimResult, Label, SentenceResult, SourceChunk } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CitedText } from "./cited-text";
import { ExampleProof } from "./example-proof";
import { LABEL_TONE, ProofMark } from "./proof-mark";

export type Selection =
  | { exchangeId: string; kind: "sentence"; index: number }
  | { exchangeId: string; kind: "source"; label: string; fromSentence?: number; claim?: string };

/** A selection before it is tied to an exchange (Omit, applied to each union member). */
export type LocalSelection = Selection extends infer S
  ? S extends Selection
    ? Omit<S, "exchangeId">
    : never
  : never;

// Mirrors contradiction_threshold in backend/config.yaml: above it, NLI alone flags a claim.
const STRONG_CONTRADICTION = 0.7;

export function Inspector({
  response,
  selection,
  onSelect,
  onClose,
}: {
  response: ChatResponse | undefined;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
  onClose: () => void;
}) {
  if (!response || !selection) return <InspectorEmpty />;

  if (selection.kind === "sentence") {
    const sentence = response.sentences.find((s) => s.index === selection.index);
    if (!sentence) return <InspectorEmpty />;
    return (
      <Panel title="Claim check" onClose={onClose} swapKey={`s${selection.exchangeId}${sentence.index}`}>
        <SentenceDetails
          sentence={sentence}
          sources={response.sources}
          onOpenSource={(label, claim) =>
            onSelect({ exchangeId: selection.exchangeId, kind: "source", label, fromSentence: sentence.index, claim })
          }
        />
      </Panel>
    );
  }

  const source = response.sources.find((s) => s.label === selection.label);
  if (!source) return <InspectorEmpty />;
  return (
    <Panel
      title={`Source ${source.label}`}
      onClose={onClose}
      swapKey={`p${selection.exchangeId}${source.label}${selection.claim ?? ""}`}
      onBack={
        selection.fromSentence !== undefined
          ? () => onSelect({ exchangeId: selection.exchangeId, kind: "sentence", index: selection.fromSentence! })
          : undefined
      }
    >
      <SourceDetails source={source} claim={selection.claim} />
    </Panel>
  );
}

function Panel({
  title,
  onClose,
  onBack,
  swapKey,
  children,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  swapKey: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sheet">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-rule px-3">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to the claim check">
            <ArrowLeftIcon />
          </Button>
        )}
        <h2 className="flex-1 px-1 text-sm font-semibold">{title}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close the inspector">
          <XIcon />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
        {/* Keyed so each new selection fades in instead of snapping. */}
        <div key={swapKey} className="fade-swap space-y-5 p-5">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}

function InspectorEmpty() {
  return (
    <div className="flex h-full flex-col bg-sheet">
      <div className="flex h-12 shrink-0 items-center border-b border-rule px-4">
        <h2 className="text-sm font-semibold">Claim check</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 text-sm">
        <p className="max-w-[34ch] text-muted-foreground">
          Select a sentence, or its mark in the margin, to see how each of its claims was checked. Select a
          citation to read the source passage.
        </p>
        <section aria-labelledby="reading-heading" className="space-y-3">
          <h3 id="reading-heading" className="font-serif text-lg font-semibold tracking-[-0.01em]">
            How to read a proof
          </h3>
          <ExampleProof />
        </section>
        <MarkLegend />
      </div>
    </div>
  );
}

/** The three labels, each shown as the mark that stands for it, set against the same ruled pencil
 *  margin the answers carry. */
export function MarkLegend({ className }: { className?: string }) {
  return (
    <dl className={cn("space-y-3 border-l-[3px] border-double border-pencil/45 pl-4", className)}>
      {(["high", "inferred", "hallucinated"] as Label[]).map((label) => (
        <div key={label} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3">
          <ProofMark label={label} className="mt-0.5" />
          <dt className="font-medium">{LABEL_TEXT[label]}</dt>
          <dd className="col-start-2 text-muted-foreground">{LABEL_HINT[label]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A label as the checker writes it: its mark and its name, in its colour. */
export function LabelTag({ label, className }: { label: Label; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", LABEL_TONE[label], className)}>
      <ProofMark label={label} className="size-3.5" />
      {LABEL_TEXT[label]}
    </span>
  );
}

function SentenceDetails({
  sentence,
  sources,
  onOpenSource,
}: {
  sentence: SentenceResult;
  sources: SourceChunk[];
  onOpenSource: (label: string, claim: string) => void;
}) {
  return (
    <>
      <div className="space-y-2.5">
        {sentence.label && <LabelTag label={sentence.label} />}
        <p className="font-serif text-[1.0625rem] leading-relaxed">
          <CitedText
            text={sentence.text}
            onCite={(label) => onOpenSource(label, sentence.text)}
            sources={sources}
          />
        </p>
        <p className="text-[13px] text-muted-foreground">
          {sentence.claims.length === 1
            ? "This sentence makes one claim."
            : `This sentence makes ${sentence.claims.length} claims. It takes the label of the weakest one.`}
        </p>
      </div>
      <ol className="divide-y divide-rule border-t border-rule">
        {sentence.claims.map((claim, i) => (
          <ClaimCheck
            key={i}
            single={sentence.claims.length === 1}
            claim={claim}
            source={sources.find((s) => s.label === claim.evidence_label)}
            onOpenSource={onOpenSource}
          />
        ))}
      </ol>
    </>
  );
}

function ClaimCheck({
  claim,
  single,
  source,
  onOpenSource,
}: {
  claim: ClaimResult;
  single: boolean; // the sentence is this one claim, so its label and text are already shown above
  source: SourceChunk | undefined;
  onOpenSource: (label: string, claim: string) => void;
}) {
  const s = claim.signals;
  const facts = [
    s.self_label && ["Writer's tag", s.self_label.toLowerCase()],
    s.judge && ["Judge", s.judge],
    ["NLI verdict", claim.verdict],
  ].filter(Boolean) as [string, string][];

  return (
    <li className="space-y-3.5 py-4">
      <div className="flex items-start justify-between gap-4">
        {single ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{claim.reason}</p>
        ) : (
          <div className="space-y-1.5">
            <LabelTag label={claim.label} />
            <p className="text-sm leading-snug font-medium">{claim.text}</p>
          </div>
        )}
        <p className="shrink-0 text-right">
          <span className="block font-serif text-[1.875rem] leading-none font-semibold tracking-[-0.02em] tabular-nums">
            {percent(claim.score)}
          </span>
          <span className="text-xs text-muted-foreground">score</span>
          <span
            className="mt-1.5 block text-xs text-muted-foreground tabular-nums"
            title="Calibrated on hand-labelled claims: of the claims with this score, this share turned out to be stated or inferred by the documents."
          >
            {percent(claim.support_probability)} likely supported
          </span>
        </p>
      </div>
      {!single && <p className="text-[13px] leading-relaxed text-muted-foreground">{claim.reason}</p>}

      <dl className="grid grid-cols-[auto_minmax(0,1fr)_2.25rem] items-center gap-x-3 gap-y-2 text-[13px]">
        <Signal name="Entailment" value={s.entailment} hint="How strongly the best passage supports it (NLI)" />
        <Signal
          name="Contradiction"
          value={s.contradiction}
          hint="Strongest conflict with any passage (NLI)"
          alarm={s.contradiction >= STRONG_CONTRADICTION}
        />
        {s.consistency !== null && (
          <Signal name="Consistency" value={s.consistency} hint="How often resampled answers repeat it" />
        )}
        <Signal name="Passage match" value={s.retrieval} hint="How closely the supporting passage matches it" />
      </dl>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
        {facts.map(([name, value]) => (
          <div key={name} className="flex gap-1.5">
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="font-medium first-letter:uppercase">{value}</dd>
          </div>
        ))}
      </dl>

      {s.new_terms.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-1.5 text-[13px]">
          <span className="text-muted-foreground">Words not in the passage</span>
          {s.new_terms.map((term) => (
            <span key={term} className="rounded-[4px] bg-muted px-1.5 py-px text-foreground">
              {term}
            </span>
          ))}
        </div>
      )}

      {source && (
        <button
          type="button"
          onClick={() => onOpenSource(source.label, claim.text)}
          className="group flex w-full items-center gap-2.5 rounded-md border border-rule px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:border-pencil/40 hover:bg-pencil-soft/50"
        >
          <span className="inline-flex h-5 min-w-6 items-center justify-center rounded-[4px] bg-pencil-soft px-1 text-[11px] font-medium text-pencil tabular-nums">
            {source.label}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {source.filename}, page {source.page}
            <span className="text-muted-foreground"> · {claim.evidence_cited ? "cited" : "not cited"}</span>
          </span>
          <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ease-(--ease-out) group-hover:translate-x-0.5" />
        </button>
      )}
    </li>
  );
}

function Signal({
  name,
  value,
  hint,
  alarm = false,
}: {
  name: string;
  value: number;
  hint: string;
  alarm?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground" title={hint}>
        {name}
      </dt>
      <dd className="h-1 overflow-hidden rounded-full bg-muted" title={hint}>
        <div
          className={cn("grow-x h-full rounded-full", alarm ? "bg-halluc" : "bg-pencil/80")}
          style={{ width: `${Math.max(1.5, value * 100)}%` }}
        />
      </dd>
      <dd className={cn("text-right tabular-nums", alarm && "font-medium text-halluc")}>{value.toFixed(2)}</dd>
    </>
  );
}

function SourceDetails({ source, claim }: { source: SourceChunk; claim?: string }) {
  // Mark the sentence that best matches the claim, so the reader finds the support quickly.
  const { sentences, best } = bestSentence(source.text, claim);
  const match = useRef<HTMLElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    match.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [source.label, claim]);
  return (
    <>
      <div className="space-y-1">
        <p className="text-base leading-snug font-semibold">{source.title}</p>
        <p className="text-[13px] text-muted-foreground tabular-nums">
          {source.filename} · page {source.page} · match {source.similarity.toFixed(2)}
        </p>
      </div>
      {claim && (
        <div className="rounded-md bg-muted px-3 py-2.5 text-[13px]">
          <p className="mb-0.5 text-muted-foreground">Checking</p>
          <p className="leading-snug">
            <CitedText text={claim} />
          </p>
        </div>
      )}
      <p className="font-serif text-[0.9875rem] leading-[1.75] whitespace-pre-line">
        {sentences.map((sentence, i) =>
          i === best ? (
            <mark
              key={i}
              ref={match}
              className="evidence-flash rounded-[3px] bg-pencil-soft px-0.5 text-foreground underline decoration-pencil/60 decoration-2 underline-offset-4"
            >
              {sentence}{" "}
            </mark>
          ) : (
            <span key={i} className={best >= 0 ? "text-muted-foreground" : undefined}>
              {sentence}{" "}
            </span>
          ),
        )}
      </p>
      {best >= 0 && (
        <p className="text-[13px] text-muted-foreground">
          The marked sentence shares the most words with the claim. The verdict itself comes from the NLI model,
          which reads the passage in short windows.
        </p>
      )}
    </>
  );
}
