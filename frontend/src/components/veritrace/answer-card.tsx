"use client";

import { CpuIcon, InfoIcon, SearchIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LABEL_BAR, LABEL_HINT, LABEL_TEXT, percent } from "@/lib/labels";
import type { ChatResponse, Label } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CitedText } from "./cited-text";
import { HighlightedAnswer } from "./highlighted-answer";

const ORDER: Label[] = ["high", "inferred", "hallucinated"];

/** A finished answer: confidence summary, warnings, the highlighted text and its sources. */
export function AnswerCard({
  response,
  selectedSentence,
  activeSource,
  onSelectSentence,
  onCite,
}: {
  response: ChatResponse;
  selectedSentence: number | null;
  activeSource: string | null;
  onSelectSentence: (index: number) => void;
  onCite: (label: string) => void;
}) {
  const total = response.counts.high + response.counts.inferred + response.counts.hallucinated;
  const checked = (
    <HighlightedAnswer
      sentences={response.sentences}
      selected={selectedSentence}
      onSelect={onSelectSentence}
      onCite={onCite}
    />
  );

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      {total > 0 && <ConfidenceSummary response={response} total={total} />}

      {response.low_coverage && (
        <Alert className="border-inferred/40 bg-inferred-soft/60">
          <TriangleAlertIcon className="text-inferred" />
          <AlertTitle>The documents barely cover this question</AlertTitle>
          <AlertDescription>
            The best passage matched only {response.sources[0]?.similarity.toFixed(2)} after{" "}
            {response.retrieval_attempts} searches. Treat the answer with caution.
          </AlertDescription>
        </Alert>
      )}

      {response.revised_answer ? (
        <Tabs defaultValue="checked">
          <TabsList>
            <TabsTrigger value="checked">Checked answer</TabsTrigger>
            <TabsTrigger value="safe">
              <ShieldCheckIcon /> Safe version
            </TabsTrigger>
          </TabsList>
          <TabsContent value="checked" className="pt-2">
            {checked}
          </TabsContent>
          <TabsContent value="safe" className="space-y-2 pt-2">
            <p className="text-[1.0625rem] leading-[1.95]">
              <CitedText text={response.revised_answer} onCite={onCite} activeSource={activeSource} />
            </p>
            <p className="text-xs text-muted-foreground">
              Rewritten without the {response.counts.hallucinated} flagged{" "}
              {response.counts.hallucinated === 1 ? "claim" : "claims"}. The rewrite itself is not re-checked.
            </p>
          </TabsContent>
        </Tabs>
      ) : (
        checked
      )}

      {(response.extraction_fallback || response.invalid_citations.length > 0) && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {response.extraction_fallback && (
            <p className="flex items-center gap-1.5">
              <InfoIcon className="size-3.5" /> Some sentences were checked whole because claim extraction
              failed for them.
            </p>
          )}
          {response.invalid_citations.length > 0 && (
            <p className="flex items-center gap-1.5 text-halluc">
              <TriangleAlertIcon className="size-3.5" /> The answer cites sources that do not exist:{" "}
              {response.invalid_citations.join(", ")}.
            </p>
          )}
        </div>
      )}

      {response.sources.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Sources</p>
          <div className="flex flex-wrap gap-1.5">
            {response.sources.map((source) => {
              const cited = response.cited_labels.includes(source.label);
              return (
                <button
                  key={source.label}
                  type="button"
                  onClick={() => onCite(source.label)}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    activeSource === source.label && "border-primary bg-accent",
                    !cited && "opacity-70",
                  )}
                >
                  <span className="font-mono text-primary">{source.label}</span>
                  <span className="truncate">
                    {source.filename}, p. {source.page}
                  </span>
                  {!cited && <span className="text-muted-foreground">(not cited)</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnswerDetails response={response} />
    </div>
  );
}

/** How the answer was produced: the model that wrote it and the searches the agent ran. */
function AnswerDetails({ response }: { response: ChatResponse }) {
  return (
    <div className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
      <p className="flex items-center gap-1.5">
        <CpuIcon className="size-3.5 shrink-0" />
        Answered by <span className="font-mono text-foreground">{response.model}</span>
        <span>({response.provider})</span>
      </p>
      {response.queries.length > 0 && (
        <div className="flex items-start gap-1.5">
          <SearchIcon className="mt-0.5 size-3.5 shrink-0" />
          <div className="flex flex-wrap items-center gap-1">
            <span>
              {response.retrieval_attempts > 1
                ? `Searched ${response.retrieval_attempts} times for`
                : "Searched for"}
            </span>
            {response.queries.map((query) => (
              <span key={query} className="rounded border bg-muted/40 px-1.5 py-0.5 text-foreground">
                {query}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfidenceSummary({ response, total }: { response: ChatResponse; total: number }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <div className="flex items-baseline gap-1">
          <span className="font-heading text-4xl leading-none font-semibold tabular-nums">
            {response.answer_confidence === null ? "–" : percent(response.answer_confidence)}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">answer confidence</p>
      </div>
      <div className="min-w-[14rem] flex-1 space-y-2">
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          {ORDER.map((label) =>
            response.counts[label] > 0 ? (
              <div
                key={label}
                className={LABEL_BAR[label]}
                style={{ width: `${(response.counts[label] / total) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {ORDER.map((label) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-default items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", LABEL_BAR[label])} />
                  <span className="font-mono tabular-nums">{response.counts[label]}</span>
                  <span className="text-muted-foreground">{LABEL_TEXT[label].toLowerCase()}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{LABEL_HINT[label]}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
