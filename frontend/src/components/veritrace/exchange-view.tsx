"use client";

import { CircleXIcon, ClipboardCheckIcon, FileTextIcon, ShieldCheckIcon, SquareIcon } from "lucide-react";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Exchange } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

import { AgentSteps } from "./agent-steps";
import { AnswerBody, VerdictCounts, VerdictHead } from "./answer-card";
import { CitedText } from "./cited-text";
import type { LocalSelection, Selection } from "./inspector";

/** One question and everything the agent produced for it, set on the sheet's twelve columns: the
 *  question across the top, the verdict (or the agent at work) in the margin columns, and the answer
 *  with its claims in the reading columns. Below 36rem of sheet the columns stack. */
export function ExchangeView({
  exchange,
  number,
  selection,
  onSelect,
}: {
  exchange: Exchange;
  number: number;
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  const mine = selection?.exchangeId === exchange.id ? selection : null;
  const select = (s: LocalSelection) => onSelect({ ...s, exchangeId: exchange.id });
  // One hover shared by the scale, the sentences and the claim list, so each lights the others.
  const [hover, setHover] = useState<number | null>(null);
  const selectedSentence = mine?.kind === "sentence" ? mine.index : null;
  const response = exchange.response;

  return (
    <section
      id={`exchange-${exchange.id}`}
      className="@container/x border-x border-b border-t-2 border-border border-t-foreground bg-sheet px-5 pt-5 pb-8 sm:px-8 sm:pt-6 sm:pb-10"
      aria-label={`Question ${number}: ${exchange.question}`}
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 @xl/x:grid-cols-12">
        <header className="contents">
          <div className="caps order-2 -mt-6 space-y-1 text-muted-foreground @xl/x:order-none @xl/x:col-span-4 @xl/x:mt-0 @xl/x:pt-2">
            <p className="text-foreground">Question {number}</p>
            {exchange.checking && (
              <p className="flex items-center gap-1.5">
                <ClipboardCheckIcon className="size-3.5" /> Checking a given answer
              </p>
            )}
            {exchange.safeMode && (
              <p className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5" /> Safe mode
              </p>
            )}
            {exchange.documents && (
              <p className="flex min-w-0 items-center gap-1.5 normal-case tracking-normal">
                <FileTextIcon className="size-3.5 shrink-0" />
                <span className="truncate text-[12.5px] font-medium">Only {exchange.documents.join(", ")}</span>
              </p>
            )}
          </div>
          <h2 className="order-1 text-[1.875rem] leading-[1.05] font-bold tracking-[-0.015em] whitespace-pre-wrap font-stretch-80% @xl/x:order-none @xl/x:col-span-8 @xl/x:text-[2.25rem] @4xl/x:text-[2.625rem]">
            {exchange.question}
          </h2>
        </header>

        {/* The verdict column. Two-column, it is one sticky block beside the answer. Stacked, its parts
            interleave with the answer: the confidence strip before it, counts and steps after the
            claims, so the answer (and a sentence just picked) stays near the top. */}
        <div className="contents @xl/x:col-span-4 @xl/x:block">
          <div className="contents @xl/x:sticky @xl/x:top-6 @xl/x:block @xl/x:space-y-6">
            {response && (
              <div className="order-3 @xl/x:order-none">
                <VerdictHead
                  response={response}
                  hover={hover}
                  onHover={setHover}
                  selected={selectedSentence}
                  onSelect={(index) => select({ kind: "sentence", index })}
                />
              </div>
            )}
            <div className={cn("space-y-6 @xl/x:order-none", exchange.status === "running" ? "order-3" : "order-5")}>
              {response && <VerdictCounts response={response} />}
              <AgentSteps exchange={exchange} />
            </div>
          </div>
        </div>

        <div className="order-4 min-w-0 @xl/x:order-none @xl/x:col-span-8">
          {exchange.status === "running" && !exchange.draft && (
            // Where the answer will land, so the wait has a shape rather than an empty page.
            <div className="max-w-[40rem] space-y-4 pt-1" aria-hidden>
              {["w-full", "w-[94%]", "w-[98%]", "w-[62%]"].map((width) => (
                <Skeleton key={width} className={`h-4 ${width}`} />
              ))}
            </div>
          )}

          {exchange.status === "running" && exchange.draft && (
            <div className="arrive space-y-3">
              <p className="max-w-[40rem] text-[1.1875rem] leading-[1.7] text-foreground/70 sm:text-[1.25rem]">
                <CitedText text={exchange.draft} />
                <span className="ml-0.5 inline-block h-[1.1em] w-[3px] translate-y-[3px] animate-pulse bg-signal" aria-hidden />
              </p>
              <p className="caps text-muted-foreground">
                {exchange.checking ? "Checking each claim in this answer" : "Each claim is checked once the answer is written"}
              </p>
            </div>
          )}

          {response && (
            <AnswerBody
              response={response}
              checkedAt={exchange.finishedAt}
              hover={hover}
              onHover={setHover}
              selectedSentence={selectedSentence}
              activeSource={mine?.kind === "source" ? mine.label : null}
              onSelectSentence={(index) => select({ kind: "sentence", index })}
              onCite={(label) => select({ kind: "source", label })}
            />
          )}

          {exchange.status === "error" && (
            <div role="alert" className="arrive flex max-w-[40rem] items-start gap-3 border-2 border-foreground p-4 text-sm">
              <CircleXIcon className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold">No answer this time</p>
                <p className="text-muted-foreground">{exchange.error}</p>
              </div>
            </div>
          )}

          {exchange.status === "stopped" && (
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <SquareIcon className="size-3" /> Stopped before the answer was checked.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
