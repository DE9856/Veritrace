"use client";

import { CircleXIcon, FileTextIcon, ShieldCheckIcon, SquareIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Exchange } from "@/hooks/use-chat";

import { AgentSteps } from "./agent-steps";
import { AnswerCard } from "./answer-card";
import { CitedText } from "./cited-text";
import type { LocalSelection, Selection } from "./inspector";

/** One question and everything the agent produced for it. The question heads its answer, the way
 *  a query heads a fact-checker's note, rather than sitting in a chat bubble. */
export function ExchangeView({
  exchange,
  selection,
  onSelect,
}: {
  exchange: Exchange;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const mine = selection?.exchangeId === exchange.id ? selection : null;
  const select = (s: LocalSelection) => onSelect({ ...s, exchangeId: exchange.id });

  return (
    <section className="space-y-4" aria-label={`Question: ${exchange.question}`}>
      <header className="space-y-1.5">
        <h2 className="font-serif text-[1.375rem] leading-snug font-semibold tracking-[-0.012em] whitespace-pre-wrap sm:text-[1.625rem]">
          {exchange.question}
        </h2>
        {(exchange.safeMode || exchange.documents) && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            {exchange.safeMode && (
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5" /> Safe mode
              </span>
            )}
            {exchange.documents && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <FileTextIcon className="size-3.5 shrink-0" />
                <span className="truncate">Only {exchange.documents.join(", ")}</span>
              </span>
            )}
          </p>
        )}
      </header>

      <AgentSteps exchange={exchange} />

      {exchange.status === "running" && !exchange.draft && (
        // Where the answer will land, so the wait has a shape rather than an empty page.
        <div className="rounded-lg border border-rule bg-sheet/70 p-4 sm:p-6" aria-hidden>
          <div className="flex items-end gap-8">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-2 flex-1 rounded-full" />
          </div>
          <div className="mt-7 space-y-3.5">
            {["w-full", "w-[94%]", "w-[98%]", "w-[70%]"].map((width) => (
              <Skeleton key={width} className={`h-3.5 ${width}`} />
            ))}
          </div>
        </div>
      )}

      {exchange.status === "running" && exchange.draft && (
        <div className="arrive rounded-lg border bg-sheet p-4 sm:p-6">
          <p className="font-serif text-[1.0625rem] leading-[1.85] text-foreground/70 sm:text-lg sm:leading-[1.8]">
            <CitedText text={exchange.draft} />
            <span
              className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] animate-pulse bg-pencil"
              aria-hidden
            />
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground">Checking each claim once the answer is written…</p>
        </div>
      )}

      {exchange.response && (
        <AnswerCard
          response={exchange.response}
          checkedAt={exchange.finishedAt}
          selectedSentence={mine?.kind === "sentence" ? mine.index : null}
          activeSource={mine?.kind === "source" ? mine.label : null}
          onSelectSentence={(index) => select({ kind: "sentence", index })}
          onCite={(label) => select({ kind: "source", label })}
        />
      )}

      {exchange.status === "error" && (
        <div role="alert" className="arrive flex items-start gap-2.5 rounded-lg border bg-sheet p-4 text-sm">
          <CircleXIcon className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">No answer this time</p>
            <p className="text-muted-foreground">{exchange.error}</p>
          </div>
        </div>
      )}

      {exchange.status === "stopped" && (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <SquareIcon className="size-3" /> Stopped before the answer was checked.
        </p>
      )}
    </section>
  );
}
