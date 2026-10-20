"use client";

import { ArrowLeftIcon, FileTextIcon, MousePointerClickIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LABEL_BAR, LABEL_HINT, LABEL_PILL, LABEL_TEXT, percent } from "@/lib/labels";
import type { ChatResponse, ClaimResult, Label, SentenceResult, SourceChunk } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CitedText } from "./cited-text";

export type Selection =
  | { exchangeId: string; kind: "sentence"; index: number }
  | { exchangeId: string; kind: "source"; label: string; fromSentence?: number; claim?: string };

/** A selection before it is tied to an exchange (Omit, applied to each union member). */
export type LocalSelection = Selection extends infer S
  ? S extends Selection
    ? Omit<S, "exchangeId">
    : never
  : never;

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
      <Panel title="Claim check" onClose={onClose}>
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
  children,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to the claim check">
            <ArrowLeftIcon />
          </Button>
        )}
        <h2 className="flex-1 px-1 text-sm font-medium">{title}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close the inspector">
          <XIcon />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">{children}</div>
      </ScrollArea>
    </div>
  );
}

function InspectorEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
      <MousePointerClickIcon className="size-6 opacity-60" />
      <p className="max-w-[28ch]">
        Select a highlighted sentence to see how each of its claims was checked, or a citation to read the
        source passage.
      </p>
      <div className="mt-2 flex flex-col gap-1.5 text-left text-xs">
        {(["high", "inferred", "hallucinated"] as Label[]).map((label) => (
          <div key={label} className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", LABEL_BAR[label])} />
            <span className="font-medium text-foreground">{LABEL_TEXT[label]}</span>
            <span>{LABEL_HINT[label]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LabelPill({ label, className }: { label: Label; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-wide uppercase",
        LABEL_PILL[label],
        className,
      )}
    >
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
      <div className="space-y-2">
        {sentence.label && <LabelPill label={sentence.label} />}
        <p className="text-[0.95rem] leading-relaxed">
          <CitedText text={sentence.text} onCite={(label) => onOpenSource(label, sentence.text)} />
        </p>
        <p className="text-xs text-muted-foreground">
          {sentence.claims.length === 1
            ? "This sentence makes one claim."
            : `This sentence makes ${sentence.claims.length} claims. It takes the label of the weakest one.`}
        </p>
      </div>
      {sentence.claims.map((claim, i) => (
        <ClaimCard
          key={i}
          claim={claim}
          source={sources.find((s) => s.label === claim.evidence_label)}
          onOpenSource={onOpenSource}
        />
      ))}
    </>
  );
}

function ClaimCard({
  claim,
  source,
  onOpenSource,
}: {
  claim: ClaimResult;
  source: SourceChunk | undefined;
  onOpenSource: (label: string, claim: string) => void;
}) {
  const s = claim.signals;
  return (
    <article className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-snug font-medium">{claim.text}</p>
        <div className="shrink-0 text-right">
          <div className="font-mono text-lg leading-none tabular-nums">{percent(claim.score)}</div>
          <div className="text-[10px] tracking-wide text-muted-foreground uppercase">score</div>
        </div>
      </div>
      <LabelPill label={claim.label} />
      <p className="text-sm text-muted-foreground">{claim.reason}</p>

      <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5 text-xs">
        <Signal name="Entailment" value={s.entailment} hint="How strongly the best passage supports it (NLI)" />
        <Signal
          name="Contradiction"
          value={s.contradiction}
          hint="Strongest conflict with any passage (NLI)"
          tone="bad"
        />
        {s.consistency !== null && (
          <Signal name="Consistency" value={s.consistency} hint="How often resampled answers repeat it" />
        )}
        <Signal name="Passage match" value={s.retrieval} hint="How closely the supporting passage matches it" />
      </dl>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {s.self_label && <Tag>model said {s.self_label.toLowerCase()}</Tag>}
        {s.judge && <Tag>judge: {s.judge}</Tag>}
        <Tag>NLI: {claim.verdict}</Tag>
      </div>
      {s.new_terms.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Words not in the passage:{" "}
          {s.new_terms.map((term) => (
            <span key={term} className="mr-1 rounded bg-muted px-1 font-mono text-foreground">
              {term}
            </span>
          ))}
        </p>
      )}

      {source && (
        <button
          type="button"
          onClick={() => onOpenSource(source.label, claim.text)}
          className="flex w-full items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2 text-left text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <FileTextIcon className="size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-mono text-primary">{source.label}</span> · {source.filename}, page {source.page}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {claim.evidence_cited ? "cited" : "not cited"}
          </span>
        </button>
      )}
    </article>
  );
}

function Signal({
  name,
  value,
  hint,
  tone = "good",
}: {
  name: string;
  value: number;
  hint: string;
  tone?: "good" | "bad";
}) {
  return (
    <>
      <dt className="text-muted-foreground" title={hint}>
        {name}
      </dt>
      <dd className="h-1.5 overflow-hidden rounded-full bg-muted" title={hint}>
        <div
          className={cn("h-full rounded-full", tone === "bad" ? "bg-halluc/70" : "bg-primary")}
          style={{ width: `${Math.max(2, value * 100)}%` }}
        />
      </dd>
      <dd className="w-8 text-right font-mono tabular-nums">{value.toFixed(2)}</dd>
    </>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded border px-1.5 py-0.5 text-muted-foreground">{children}</span>;
}

const STOP = new Set("the a an and or of in on at to for from by with was were is are that this its".split(" "));

const contentWords = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [],
  );

/** Split a passage into sentences and find the one that shares most words with the claim. */
function bestSentence(text: string, claim: string | undefined): { sentences: string[]; best: number } {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
  if (!claim) return { sentences, best: -1 };
  const words = contentWords(claim);
  let best = -1;
  let bestShare = 0.25; // below this, nothing is worth pointing at
  sentences.forEach((sentence, i) => {
    const shared = [...contentWords(sentence)].filter((w) => words.has(w)).length;
    const share = shared / Math.max(words.size, 1);
    if (share > bestShare) [best, bestShare] = [i, share];
  });
  return { sentences, best };
}

function SourceDetails({ source, claim }: { source: SourceChunk; claim?: string }) {
  // Mark the sentence that best matches the claim, so the reader finds the support quickly.
  const { sentences, best } = bestSentence(source.text, claim);
  return (
    <>
      <div className="space-y-1">
        <p className="font-heading text-base leading-tight">{source.title}</p>
        <p className="text-xs text-muted-foreground">
          {source.filename} · page {source.page} · match {source.similarity.toFixed(2)}
        </p>
      </div>
      {claim && (
        <p className="rounded-md bg-muted px-2.5 py-2 text-xs">
          <span className="text-muted-foreground">Checking: </span>
          {claim}
        </p>
      )}
      <p className="text-sm leading-relaxed whitespace-pre-line">
        {sentences.map((sentence, i) =>
          i === best ? (
            <mark key={i} className="rounded-sm bg-accent px-0.5 text-foreground ring-1 ring-primary/30">
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
        <p className="text-xs text-muted-foreground">
          The highlighted sentence shares the most words with the claim. The verdict itself comes from the NLI
          model, which reads the passage in short windows.
        </p>
      )}
    </>
  );
}
