"use client";

import { CheckIcon, ChevronDownIcon, CircleXIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";

import type { Exchange } from "@/hooks/use-chat";
import { STEP_NAMES, seconds } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** The agent's path through the graph: live while it runs, a one-line summary after. */
export function AgentSteps({ exchange }: { exchange: Exchange }) {
  const [open, setOpen] = useState(false);
  const running = exchange.status === "running";
  const timings = exchange.response?.timings_ms ?? {};
  const retries = exchange.steps.filter((s) => s.node === "analyze").length - 1;
  const total = (exchange.finishedAt ?? exchange.startedAt) - exchange.startedAt; // shown once finished

  if (!running && exchange.steps.length === 0) return null;

  const list = (
    <ol className="space-y-1.5">
      {exchange.steps.map((step, i) => {
        const current = running && i === exchange.steps.length - 1;
        // Judge and consistency run in parallel, so the step before the last may still be busy.
        const parallel =
          running && i === exchange.steps.length - 2 && ["judge", "consistency"].includes(step.node);
        const failed = exchange.status === "error" && i === exchange.steps.length - 1;
        const isRetry = step.node === "analyze" && i > 0;
        const lastOfKind = exchange.steps.findLastIndex((s) => s.node === step.node) === i;
        return (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
              {current || parallel ? (
                <Loader2Icon className="size-3.5 animate-spin text-primary" />
              ) : failed ? (
                <CircleXIcon className="size-3.5 text-halluc" />
              ) : isRetry ? (
                <RotateCcwIcon className="size-3.5 text-inferred" />
              ) : (
                <CheckIcon className="size-3.5 text-high" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("font-medium", !(current || parallel) && "text-foreground/80")}>
                {STEP_NAMES[step.node] ?? step.node}
              </span>
              <span className="text-muted-foreground"> · {step.message}</span>
            </span>
            {lastOfKind && timings[step.node] !== undefined && (
              <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                {seconds(timings[step.node])}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );

  if (running) return <div className="rounded-lg border border-dashed bg-card/60 p-3">{list}</div>;

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        Agent took {exchange.steps.length} steps in {seconds(total)}
        {retries > 0 && ` · rewrote the search ${retries === 1 ? "once" : `${retries} times`}`}
      </button>
      {open && <div className="mt-2 rounded-lg border bg-card/60 p-3">{list}</div>}
    </div>
  );
}
