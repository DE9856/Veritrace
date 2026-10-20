"use client";

import { CircleXIcon, ShieldCheckIcon, SquareIcon } from "lucide-react";

import type { Exchange } from "@/hooks/use-chat";

import { AgentSteps } from "./agent-steps";
import { AnswerCard } from "./answer-card";
import type { LocalSelection, Selection } from "./inspector";

/** One question and everything the agent produced for it. */
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
    <section className="space-y-3" aria-label={`Question: ${exchange.question}`}>
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-3.5 py-2 text-primary-foreground dark:border dark:border-primary/30 dark:bg-accent dark:text-foreground">
          <p className="whitespace-pre-wrap">{exchange.question}</p>
          {exchange.safeMode && (
            <p className="mt-1 flex items-center gap-1 text-xs opacity-80">
              <ShieldCheckIcon className="size-3" /> Safe mode
            </p>
          )}
        </div>
      </div>

      <AgentSteps exchange={exchange} />

      {exchange.status === "running" && exchange.draft && (
        <div className="rounded-xl border bg-card p-4 text-[1.0625rem] leading-[1.95] text-foreground/75 sm:p-5">
          {exchange.draft}
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" aria-hidden />
          <p className="mt-2 text-xs text-muted-foreground">Checking each claim once the answer is written…</p>
        </div>
      )}

      {exchange.response && (
        <AnswerCard
          response={exchange.response}
          selectedSentence={mine?.kind === "sentence" ? mine.index : null}
          activeSource={mine?.kind === "source" ? mine.label : null}
          onSelectSentence={(index) => select({ kind: "sentence", index })}
          onCite={(label) => select({ kind: "source", label })}
        />
      )}

      {exchange.status === "error" && (
        <div className="flex items-start gap-2 rounded-xl border border-halluc/40 bg-halluc-soft/50 p-3 text-sm">
          <CircleXIcon className="mt-0.5 size-4 shrink-0 text-halluc" />
          <div>
            <p className="font-medium">No answer this time</p>
            <p className="text-muted-foreground">{exchange.error}</p>
          </div>
        </div>
      )}

      {exchange.status === "stopped" && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <SquareIcon className="size-3" /> Stopped.
        </p>
      )}
    </section>
  );
}
