"use client";

import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { bestSentence } from "@/lib/evidence";
import { LABEL_HINT, LABEL_TEXT, numberClaims, percent } from "@/lib/labels";
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

export const PANEL_ID = "claim-panel";

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
  if (!response || !selection) return <InspectorEmpty onClose={onClose} />;

  if (selection.kind === "sentence") {
    const sentence = response.sentences.find((s) => s.index === selection.index);
    if (!sentence) return <InspectorEmpty onClose={onClose} />;
    const numbers = numberClaims(response.sentences).get(sentence.index) ?? [];
    const range = numbers.length > 1 ? `Claims ${numbers[0]}–${numbers.at(-1)}` : `Claim ${numbers[0]}`;
    return (
      <Panel title="Claim check" detail={range} onClose={onClose} swapKey={`s${selection.exchangeId}${sentence.index}`}>
        <SentenceDetails
          sentence={sentence}
          numbers={numbers}
          sources={response.sources}
          onOpenSource={(label, claim) =>
            onSelect({ exchangeId: selection.exchangeId, kind: "source", label, fromSentence: sentence.index, claim })
          }
        />
      </Panel>
    );
  }

  const source = response.sources.find((s) => s.label === selection.label);
  if (!source) return <InspectorEmpty onClose={onClose} />;
  return (
    <Panel
      title="Source"
      detail={source.label}
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
  detail,
  onClose,
  onBack,
  swapKey,
  children,
}: {
  title: string;
  detail?: string;
  onClose: () => void;
  onBack?: () => void;
  swapKey: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sheet">
      <PanelHead title={title} detail={detail} onClose={onClose} onBack={onBack} />
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
        {/* Keyed so each new selection fades in instead of snapping. */}
        <div key={swapKey} className="fade-swap space-y-6 px-6 py-6">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}

function PanelHead({
  title,
  detail,
  onClose,
  onBack,
}: {
  title: string;
  detail?: string;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-1 border-b-2 border-foreground px-3">
      {onBack && (
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to the claim check">
          <ArrowLeftIcon />
        </Button>
      )}
      <h2 className="flex flex-1 items-baseline gap-2.5 px-2">
        <span className="caps">{title}</span>
        {detail && <span className="figures text-[13px] text-muted-foreground">{detail}</span>}
      </h2>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close the claim panel">
        <XIcon />
      </Button>
    </div>
  );
}

function InspectorEmpty({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sheet">
      <PanelHead title="Claim check" onClose={onClose} />
      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6 text-sm">
        <p className="max-w-[36ch] text-[15px] leading-relaxed text-muted-foreground">
          Select a sentence, a claim or a mark on the scale to see how each claim was checked. Select a citation to
          read its source passage.
        </p>
        <section aria-labelledby="reading-heading" className="space-y-4">
          <h3 id="reading-heading" className="text-xl font-bold tracking-[-0.01em] font-stretch-80%">
            How to read an answer
          </h3>
          <ExampleProof />
        </section>
        <MarkLegend />
      </div>
    </div>
  );
}

/** The three labels, each with the mark that stands for it and the score band it covers. */
export function MarkLegend({ className }: { className?: string }) {
  const bands: Record<Label, string> = { high: "75–100", inferred: "45–74", hallucinated: "0–44" };
  return (
    <dl className={cn("divide-y divide-rule border-y-2 border-foreground", className)}>
      {(["high", "inferred", "hallucinated"] as Label[]).map((label) => (
        <div key={label} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-x-3 py-3">
          <ProofMark label={label} className="mt-0.5" />
          <dt className="font-semibold">{LABEL_TEXT[label]}</dt>
          <dd className="figures text-right text-muted-foreground">{bands[label]}</dd>
          <dd className="col-span-2 col-start-2 text-muted-foreground">{LABEL_HINT[label]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A label as the checker writes it: its mark and its name, in its colour. */
export function LabelTag({ label, className }: { label: Label; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold", LABEL_TONE[label], className)}>
      <ProofMark label={label} className="size-3.5" />
      {LABEL_TEXT[label]}
    </span>
  );
}

function SentenceDetails({
  sentence,
  numbers,
  sources,
  onOpenSource,
}: {
  sentence: SentenceResult;
  numbers: number[];
  sources: SourceChunk[];
  onOpenSource: (label: string, claim: string) => void;
}) {
  return (
    <>
      <div className="space-y-3">
        {sentence.label && <LabelTag label={sentence.label} />}
        <p className="text-[1.0625rem] leading-relaxed">
          <CitedText text={sentence.text} onCite={(label) => onOpenSource(label, sentence.text)} sources={sources} />
        </p>
        <p className="text-[13px] text-muted-foreground">
          {sentence.claims.length === 1
            ? "This sentence makes one claim."
            : `This sentence makes ${sentence.claims.length} claims. It takes the label of the weakest one.`}
        </p>
      </div>
      <ol className="space-y-8">
        {sentence.claims.map((claim, i) => (
          <ClaimCheck
            key={i}
            n={numbers[i]}
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
  n,
  claim,
  source,
  onOpenSource,
}: {
  n: number;
  claim: ClaimResult;
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
    <li className="space-y-4 border-t-2 border-foreground pt-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4">
        <div className="space-y-2">
          <p className="flex items-baseline gap-2.5">
            <span className="figures text-[15px] font-bold font-stretch-75%">{n}</span>
            <LabelTag label={claim.label} />
          </p>
          <p className="text-[15px] leading-snug font-medium">{claim.text}</p>
        </div>
        <p className="text-right">
          <span className="figures block text-[3rem] leading-[0.85] font-extrabold tracking-[-0.02em] font-stretch-62%">
            {percent(claim.score)}
          </span>
          <span className="caps mt-1.5 block text-muted-foreground">Score</span>
        </p>
      </div>
      <p className="text-[13.5px] leading-relaxed text-muted-foreground">{claim.reason}</p>
      <p
        className="figures text-[13px]"
        title="Calibrated on hand-labelled claims: of the claims with this score, this share turned out to be stated or inferred by the documents."
      >
        <span className="font-semibold">{percent(claim.support_probability)}%</span>{" "}
        <span className="text-muted-foreground">calibrated chance it is supported</span>
      </p>

      {/* Every signal on the same 0 to 1 ramp, quartered, so claims compare at a glance. */}
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-2.5 text-[13px]">
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

      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        {facts.map(([name, value]) => (
          <div key={name} className="flex gap-1.5">
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="font-semibold first-letter:uppercase">{value}</dd>
          </div>
        ))}
      </dl>

      {s.new_terms.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-1.5 text-[13px]">
          <span className="text-muted-foreground">Words not in the passage</span>
          {s.new_terms.map((term) => (
            <span key={term} className="bg-muted px-1.5 py-px text-foreground">
              {term}
            </span>
          ))}
        </div>
      )}

      {source && (
        <button
          type="button"
          onClick={() => onOpenSource(source.label, claim.text)}
          className="group flex w-full items-center gap-3 border border-foreground/80 px-3 py-2.5 text-left text-[13px] transition-colors duration-150 hover:bg-signal-soft"
        >
          <span className="figures bg-signal px-1 text-[11px] font-bold text-primary-foreground">{source.label}</span>
          <span className="min-w-0 flex-1 truncate">
            {source.filename}, page {source.page}
            <span className="text-muted-foreground"> · {claim.evidence_cited ? "cited" : "not cited"}</span>
          </span>
          <ArrowRightIcon className="size-3.5 shrink-0 transition-transform duration-150 ease-(--ease-out) group-hover:translate-x-0.5" />
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
      <dd className="relative h-2 bg-muted" title={hint}>
        <div
          className={cn("grow-x h-full", alarm ? "bg-halluc" : "bg-foreground/80")}
          style={{ width: `${Math.max(1.5, value * 100)}%` }}
        />
        {[25, 50, 75].map((q) => (
          <span key={q} aria-hidden className="absolute inset-y-0 w-px bg-background" style={{ left: `${q}%` }} />
        ))}
      </dd>
      <dd className={cn("figures text-right", alarm && "font-semibold text-halluc")}>{value.toFixed(2)}</dd>
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
        <p className="text-lg leading-snug font-bold font-stretch-90%">{source.title}</p>
        <p className="figures text-[13px] text-muted-foreground">
          {source.filename} · page {source.page} · match {source.similarity.toFixed(2)}
        </p>
      </div>
      {claim && (
        <div className="bg-muted px-4 py-3 text-[13px]">
          <p className="caps mb-1 text-muted-foreground">Checking</p>
          <p className="leading-snug">
            <CitedText text={claim} />
          </p>
        </div>
      )}
      <p className="text-[0.9875rem] leading-[1.75] whitespace-pre-line">
        {sentences.map((sentence, i) =>
          i === best ? (
            <mark
              key={i}
              ref={match}
              className="evidence-flash bg-signal-soft px-0.5 text-foreground underline decoration-signal/60 decoration-2 underline-offset-4"
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
