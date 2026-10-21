"use client";

import { InfoIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { useId } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LABEL_HINT, LABEL_TEXT, numberClaims, percent } from "@/lib/labels";
import type { ChatResponse, Label } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CitedText } from "./cited-text";
import { HighlightedAnswer } from "./highlighted-answer";
import { LABEL_TONE, ProofMark } from "./proof-mark";
import { type ScaleClaim, VerdictScale } from "./verdict-scale";

const ORDER: Label[] = ["high", "inferred", "hallucinated"];

/** Every claim of an answer with its number, for the scale and the claim list. */
function claimsOf(response: ChatResponse) {
  const numbers = numberClaims(response.sentences);
  return response.sentences.flatMap((sentence) =>
    sentence.claims.map((claim, j) => ({ claim, sentence: sentence.index, n: numbers.get(sentence.index)![j] })),
  );
}

/** The head of the verdict column: the answer's confidence as a large figure and the threshold
 *  scale with every claim on it. Stacked (a narrow sheet), the two sit side by side in one strip
 *  so the answer still starts high on the screen. */
export function VerdictHead({
  response,
  hover,
  onHover,
  selected,
  onSelect,
}: {
  response: ChatResponse;
  hover: number | null;
  onHover: (index: number | null) => void;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const claims = claimsOf(response);
  const confidence = response.answer_confidence;
  if (claims.length === 0) {
    return (
      <p className="max-w-[28ch] text-[15px] text-muted-foreground">
        Nothing to check: the answer makes no factual claims about the documents.
      </p>
    );
  }
  const scale: ScaleClaim[] = claims.map(({ claim, sentence, n }) => ({
    n,
    sentence,
    label: claim.label,
    score: claim.score,
  }));

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-6 @xl/x:block @xl/x:space-y-6">
      <div>
        <p className="figures flex items-baseline gap-1.5">
          <span className="arrive text-[4rem] leading-[0.8] font-extrabold tracking-[-0.03em] font-stretch-62% @xl/x:text-[6.5rem] @4xl/x:text-[8.5rem]">
            {confidence === null ? "–" : percent(confidence)}
          </span>
          <span className="text-[15px] text-muted-foreground @xl/x:text-lg">/ 100</span>
        </p>
        <p className="caps mt-2 text-muted-foreground @xl/x:mt-3">Confidence</p>
      </div>
      <VerdictScale
        claims={scale}
        confidence={confidence}
        hover={hover}
        onHover={onHover}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

/** The count of claims per label, under the scale (or after the claims when the sheet is narrow). */
export function VerdictCounts({ response }: { response: ChatResponse }) {
  const total = response.counts.high + response.counts.inferred + response.counts.hallucinated;
  if (total === 0) return null;
  return (
    <div>
      <ul className="divide-y divide-rule border-y-2 border-foreground text-[14px]">
        {ORDER.map((label) => {
          const count = response.counts[label];
          return (
            <li key={label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="flex cursor-default items-center gap-2.5 py-2">
                    <ProofMark label={label} className={cn("size-3.5", count === 0 && "opacity-35")} />
                    <span className={cn("flex-1", count === 0 && "text-muted-foreground")}>{LABEL_TEXT[label]}</span>
                    <span
                      className={cn(
                        "figures text-[1.375rem] leading-none font-bold font-stretch-75%",
                        count === 0 && "text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">{LABEL_HINT[label]}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      <span className="sr-only">
        {total} claims checked: {ORDER.map((l) => `${response.counts[l]} ${LABEL_TEXT[l].toLowerCase()}`).join(", ")}.
      </span>
    </div>
  );
}

/** The answer column: the checked text (and the safe version), notes, the numbered claims, the
 *  sources searched and the searches run. */
export function AnswerBody({
  response,
  checkedAt,
  hover,
  onHover,
  selectedSentence,
  activeSource,
  onSelectSentence,
  onCite,
}: {
  response: ChatResponse;
  checkedAt?: number;
  hover: number | null;
  onHover: (index: number | null) => void;
  selectedSentence: number | null;
  activeSource: string | null;
  onSelectSentence: (index: number) => void;
  onCite: (label: string) => void;
}) {
  const sourcesId = useId();
  const claimsId = useId();
  const claims = claimsOf(response);
  const removed = response.sentences.filter((s) => s.label === "hallucinated");
  const checked = (
    <HighlightedAnswer
      sentences={response.sentences}
      selected={selectedSentence}
      onSelect={onSelectSentence}
      onCite={onCite}
      sources={response.sources}
      hover={hover}
      onHover={onHover}
    />
  );

  return (
    <article className="@container/body space-y-10" aria-label="Checked answer">
      <div className="space-y-5">
        {response.low_coverage && (
          <div role="note" className="flex max-w-[40rem] gap-3 bg-inferred-soft px-4 py-3 text-sm">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-inferred" />
            <div>
              <p className="font-semibold">The documents barely cover this question</p>
              <p className="text-foreground/80">
                The best passage matched only {response.sources[0]?.similarity.toFixed(2)} after{" "}
                {response.retrieval_attempts} searches. Treat the answer with caution.
              </p>
            </div>
          </div>
        )}

        {response.revised_answer ? (
          <Tabs defaultValue="checked" className="gap-5">
            <TabsList variant="line" className="h-8 gap-6 p-0">
              <TabsTrigger value="checked" className="flex-none px-0 text-[14px]">
                Checked answer
              </TabsTrigger>
              <TabsTrigger value="safe" className="flex-none px-0 text-[14px]">
                <ShieldCheckIcon /> Safe version
              </TabsTrigger>
            </TabsList>
            {/* Kept mounted, so switching back does not replay the landing. */}
            <TabsContent value="checked" forceMount className="data-[state=inactive]:hidden">
              {checked}
            </TabsContent>
            <TabsContent value="safe" forceMount className="fade-swap space-y-4 data-[state=inactive]:hidden">
              <p className="max-w-[40rem] text-[1.1875rem] leading-[1.7] sm:text-[1.25rem]">
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
              {/* What the rewrite cut stays visible, struck, rather than silently disappearing. */}
              {removed.length > 0 && (
                <section className="max-w-[40rem] space-y-2 border-t-2 border-foreground pt-3">
                  <h4 className="caps text-muted-foreground">Removed from this version</h4>
                  <ul className="divide-y divide-rule">
                    {removed.map((sentence) => (
                      <li key={sentence.index} className="flex items-baseline gap-3 py-2">
                        <ProofMark label="hallucinated" className="size-3.5 translate-y-0.5" />
                        <span className="min-w-0 flex-1 text-[15px] leading-relaxed text-foreground/75 line-through decoration-halluc/80 decoration-2">
                          <CitedText text={sentence.text} />
                        </span>
                        <span className="figures text-[15px] font-bold font-stretch-75%">
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

      {claims.length > 0 && (
        <section aria-labelledby={claimsId}>
          <div className="flex items-baseline justify-between border-b-2 border-foreground pb-2">
            <h3 id={claimsId} className="caps">
              Claims
            </h3>
            <span className="figures text-[13px] text-muted-foreground">
              {checkedAt !== undefined &&
                `Checked ${new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · `}
              {response.model} ({response.provider})
            </span>
          </div>
          {/* The claims a reader scans, each with the same furniture: number, claim, verdict, score
              and the passage it was checked against. Selecting one opens its sentence's claim check. */}
          <ol className="divide-y divide-rule border-b border-rule">
            {claims.map(({ claim, sentence, n }, i) => {
              const active = selectedSentence === sentence;
              return (
                <li key={n} className="arrive" style={{ "--delay": `${i * 60}ms` } as React.CSSProperties}>
                  <button
                    type="button"
                    onClick={() => onSelectSentence(sentence)}
                    onMouseEnter={() => onHover(sentence)}
                    onMouseLeave={() => onHover(null)}
                    aria-pressed={active}
                    aria-label={`Claim ${n}: ${claim.text}. ${LABEL_TEXT[claim.label]}, score ${percent(claim.score)}.`}
                    className={cn(
                      "grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-3 text-left transition-colors duration-150 @xl/body:grid-cols-[2.25rem_minmax(0,1fr)_11rem_3rem]",
                      "hover:bg-signal/[0.06]",
                      hover === sentence && !active && "bg-signal/[0.06]",
                      active && "bg-signal-soft",
                    )}
                  >
                    <span className="figures pl-1 text-[15px] font-bold font-stretch-75%">{n}</span>
                    <span className="text-[15px] leading-snug">{claim.text}</span>
                    <span
                      className={cn(
                        "col-start-2 row-start-2 flex items-center gap-1.5 text-[13px] font-semibold @xl/body:col-start-3 @xl/body:row-start-1",
                        LABEL_TONE[claim.label],
                      )}
                    >
                      <ProofMark label={claim.label} animate delay={i * 60 + 120} className="size-3.5" />
                      {LABEL_TEXT[claim.label]}
                    </span>
                    <span className="figures col-start-3 row-span-2 row-start-1 pr-1 text-right text-[1.625rem] leading-none font-extrabold font-stretch-62% @xl/body:col-start-4 @xl/body:row-span-1">
                      {percent(claim.score)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {response.sources.length > 0 && (
        <section aria-labelledby={sourcesId}>
          <h3 id={sourcesId} className="caps border-b-2 border-foreground pb-2">
            Sources searched
          </h3>
          <ul className="divide-y divide-rule border-b border-rule">
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
                      "group grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 py-2.5 text-left text-[14px] transition-colors duration-150 hover:bg-signal/[0.06]",
                      active && "bg-signal-soft hover:bg-signal-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "figures ml-1 w-fit px-1 text-[12px] font-bold",
                        active ? "bg-signal text-primary-foreground" : "bg-signal-soft text-signal",
                      )}
                    >
                      {source.label}
                    </span>
                    <span className={cn("min-w-0 truncate", !cited && "text-muted-foreground")}>
                      {source.filename}
                      <span className="text-muted-foreground">, p. {source.page}</span>
                    </span>
                    <span className="figures pr-1 text-[13px] text-muted-foreground">
                      {cited ? "cited · " : "not cited · "}
                      {source.similarity.toFixed(2)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {response.queries.length > 0 && (
        <section className="flex flex-wrap items-baseline gap-2 text-[13px]">
          <h3 className="caps mr-1 text-muted-foreground">
            {response.retrieval_attempts > 1 ? `Searched ${response.retrieval_attempts} times for` : "Searched for"}
          </h3>
          {response.queries.map((query) => (
            <span key={query} className="bg-muted px-2 py-0.5 text-foreground/85">
              {query}
            </span>
          ))}
        </section>
      )}
    </article>
  );
}
