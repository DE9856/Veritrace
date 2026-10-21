"use client";

import { InfoIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { useId, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LABEL_BAR, LABEL_HINT, LABEL_TEXT, percent } from "@/lib/labels";
import type { ChatResponse, Label } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CitedText } from "./cited-text";
import { HighlightedAnswer } from "./highlighted-answer";
import { ProofMark } from "./proof-mark";

const ORDER: Label[] = ["high", "inferred", "hallucinated"];

/** A finished answer: confidence summary, warnings, the checked proof and its sources. */
export function AnswerCard({
  response,
  checkedAt,
  selectedSentence,
  activeSource,
  onSelectSentence,
  onCite,
}: {
  response: ChatResponse;
  checkedAt?: number; // when the verdict arrived, for the proof's slug
  selectedSentence: number | null;
  activeSource: string | null;
  onSelectSentence: (index: number) => void;
  onCite: (label: string) => void;
}) {
  const total = response.counts.high + response.counts.inferred + response.counts.hallucinated;
  const sourcesId = useId();
  // One hover shared by the claim strip, the sentences and the margin, so each lights the others.
  const [hover, setHover] = useState<number | null>(null);
  const removed = response.sentences.filter((s) => s.label === "hallucinated");
  const checked = (
    <HighlightedAnswer
      sentences={response.sentences}
      selected={selectedSentence}
      onSelect={onSelectSentence}
      onCite={onCite}
      sources={response.sources}
      hover={hover}
      onHover={setHover}
    />
  );

  return (
    <article className="arrive rounded-lg border bg-sheet" aria-label="Checked answer">
      {/* The slug at the head of a proof: what this is, when it was checked, and by which model. */}
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-t-lg border-b border-pencil/15 bg-pencil-soft/70 px-4 py-2 text-[13px] sm:px-6">
        <span className="font-semibold text-pencil">Proof</span>
        <span className="min-w-0 text-muted-foreground">
          {checkedAt !== undefined &&
            `Checked ${new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · `}
          {total} {total === 1 ? "claim" : "claims"} ·{" "}
          <span className="text-foreground/85">{response.model}</span> ({response.provider})
        </span>
      </header>
      <div className="space-y-5 p-4 sm:p-6">
        {total > 0 && (
          <ConfidenceSummary
            response={response}
            total={total}
            hover={hover}
            onHover={setHover}
            selected={selectedSentence}
            onSelect={onSelectSentence}
          />
        )}

        {response.low_coverage && (
          <div role="note" className="flex gap-2.5 rounded-md bg-inferred-soft px-3 py-2.5 text-sm">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-inferred" />
            <div>
              <p className="font-medium">The documents barely cover this question</p>
              <p className="text-foreground/75">
                The best passage matched only {response.sources[0]?.similarity.toFixed(2)} after{" "}
                {response.retrieval_attempts} searches. Treat the answer with caution.
              </p>
            </div>
          </div>
        )}

        {response.revised_answer ? (
          <Tabs defaultValue="checked" className="gap-4">
            <TabsList variant="line" className="h-8 gap-4 p-0">
              <TabsTrigger value="checked" className="flex-none px-0">
                Checked answer
              </TabsTrigger>
              <TabsTrigger value="safe" className="flex-none px-0">
                <ShieldCheckIcon /> Safe version
              </TabsTrigger>
            </TabsList>
            {/* Kept mounted, so switching back does not replay the margin marks. */}
            <TabsContent value="checked" forceMount className="data-[state=inactive]:hidden">
              {checked}
            </TabsContent>
            <TabsContent value="safe" forceMount className="fade-swap space-y-3 data-[state=inactive]:hidden">
              <p className="font-serif text-[1.0625rem] leading-[1.85] sm:text-lg sm:leading-[1.8]">
                <CitedText
                  text={response.revised_answer}
                  onCite={onCite}
                  activeSource={activeSource}
                  sources={response.sources}
                />
              </p>
              <p className="text-[13px] text-muted-foreground">
                Rewritten without the {response.counts.hallucinated} flagged{" "}
                {response.counts.hallucinated === 1 ? "claim" : "claims"}. The rewrite itself is not re-checked.
              </p>
              {/* What the rewrite cut stays on the proof, struck, rather than silently disappearing. */}
              {removed.length > 0 && (
                <section className="space-y-2 border-l-[3px] border-double border-pencil/45 pl-4">
                  <h4 className="text-[13px] font-medium text-muted-foreground">Removed from this version</h4>
                  <ul className="space-y-1.5">
                    {removed.map((sentence) => (
                      <li key={sentence.index} className="flex items-baseline gap-2.5">
                        <ProofMark label="hallucinated" className="size-3.5 translate-y-0.5" />
                        <span className="min-w-0 flex-1 font-serif text-[0.9875rem] leading-relaxed text-foreground/75 line-through decoration-halluc/80 decoration-[1.5px]">
                          <CitedText text={sentence.text} />
                        </span>
                        <span className="text-[13px] text-muted-foreground tabular-nums">
                          {percent(Math.min(...sentence.claims.map((c) => c.score)))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          checked
        )}

        {(response.extraction_fallback || response.invalid_citations.length > 0) && (
          <div className="space-y-1 text-[13px] text-muted-foreground">
            {response.extraction_fallback && (
              <p className="flex items-start gap-1.5">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" /> Some sentences were checked whole because claim
                extraction failed for them.
              </p>
            )}
            {response.invalid_citations.length > 0 && (
              <p className="flex items-start gap-1.5 text-halluc">
                <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" /> The answer cites sources that do not
                exist: {response.invalid_citations.join(", ")}.
              </p>
            )}
          </div>
        )}
      </div>

      {response.sources.length > 0 && (
        <section className="border-t border-rule px-4 py-4 sm:px-6" aria-labelledby={sourcesId}>
          <h3 id={sourcesId} className="mb-2 text-[13px] font-medium text-muted-foreground">
            Sources searched
          </h3>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {response.sources.map((source) => {
              const cited = response.cited_labels.includes(source.label);
              const active = activeSource === source.label;
              return (
                <li key={source.label}>
                  <button
                    type="button"
                    onClick={() => onCite(source.label)}
                    aria-pressed={active}
                    className={cn(
                      "group -mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-muted",
                      active && "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-6 items-center justify-center rounded-[4px] px-1 text-[11px] font-medium tabular-nums transition-colors duration-150",
                        active ? "bg-pencil text-primary-foreground" : "bg-pencil-soft text-pencil",
                      )}
                    >
                      {source.label}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate", !cited && "text-muted-foreground")}>
                      {source.filename}
                      <span className="text-muted-foreground">, p. {source.page}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {cited ? "" : "not cited · "}
                      {source.similarity.toFixed(2)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AnswerDetails response={response} />
    </article>
  );
}

/** The searches the agent ran to find the passages (the model is named in the proof's slug). */
function AnswerDetails({ response }: { response: ChatResponse }) {
  if (response.queries.length === 0) return null;
  return (
    <footer className="flex flex-wrap items-baseline gap-1.5 rounded-b-lg border-t border-rule bg-canvas px-4 py-3 text-[13px] text-muted-foreground sm:px-6">
      <span>
        {response.retrieval_attempts > 1 ? `Searched ${response.retrieval_attempts} times for` : "Searched for"}
      </span>
      {response.queries.map((query) => (
        <span key={query} className="rounded-[4px] bg-muted px-1.5 py-0.5 text-foreground/85">
          {query}
        </span>
      ))}
    </footer>
  );
}

function ConfidenceSummary({
  response,
  total,
  hover,
  onHover,
  selected,
  onSelect,
}: {
  response: ChatResponse;
  total: number;
  hover: number | null;
  onHover: (index: number | null) => void;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const confidence = response.answer_confidence;
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
      <div>
        <p className="flex items-baseline gap-1.5">
          <span className="font-serif text-[2.75rem] leading-[0.9] font-semibold tracking-[-0.02em] tabular-nums">
            {confidence === null ? "–" : percent(confidence)}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Answer confidence</p>
      </div>
      <div className="space-y-2.5">
        {/* One block per claim, in reading order: a map of the answer. Hovering a block lights its
            sentence and margin mark (and the reverse); selecting one opens its claim check. The
            sentences stay the keyboard path, so the strip is a pointer shortcut. */}
        <div className="grow-x flex h-2.5 gap-[3px]" aria-hidden>
          {response.sentences.flatMap((sentence) =>
            sentence.claims.map((claim, j) => (
              <div
                key={`${sentence.index}-${j}`}
                onMouseEnter={() => onHover(sentence.index)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(sentence.index)}
                title={`${LABEL_TEXT[claim.label]}, score ${percent(claim.score)}: ${claim.text}`}
                className={cn(
                  "h-full min-w-1.5 flex-1 cursor-pointer rounded-[2px] transition-opacity duration-150",
                  LABEL_BAR[claim.label],
                  hover !== null && hover !== sentence.index && "opacity-30",
                  selected === sentence.index && "outline-2 outline-offset-2 outline-pencil",
                )}
              />
            )),
          )}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          {ORDER.map((label) => {
            const count = response.counts[label];
            return (
              <li key={label}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="inline-flex cursor-default items-center gap-1.5 rounded-sm">
                      <ProofMark label={label} className={cn("size-3.5", count === 0 && "opacity-40")} />
                      <span className={cn("font-medium tabular-nums", count === 0 && "text-muted-foreground")}>
                        {count}
                      </span>
                      <span className="text-muted-foreground">{LABEL_TEXT[label].toLowerCase()}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{LABEL_HINT[label]}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
        <span className="sr-only">
          {total} claims checked: {ORDER.map((l) => `${response.counts[l]} ${LABEL_TEXT[l].toLowerCase()}`).join(", ")}.
        </span>
      </div>
    </div>
  );
}
