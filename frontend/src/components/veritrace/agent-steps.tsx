"use client";

import { CheckIcon, ChevronDownIcon, CircleXIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { Exchange } from "@/hooks/use-chat";
import { STEP_NAMES, seconds } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** The agent's path through the graph: a live log while it runs, a one-line summary after. */
export function AgentSteps({ exchange }: { exchange: Exchange }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const running = exchange.status === "running";
  const timings = exchange.response?.timings_ms ?? {};
  const retries = exchange.steps.filter((s) => s.node === "analyze").length - 1;
  const total = (exchange.finishedAt ?? exchange.startedAt) - exchange.startedAt; // shown once finished
  const now = useNow(running);

  // A step's time: the backend's measurement once the answer arrives, otherwise the gap until the
  // next step began (or until now, for the step still running).
  const timeOf = (i: number) => {
    const step = exchange.steps[i];
    const lastOfKind = exchange.steps.findLastIndex((s) => s.node === step.node) === i;
    if (lastOfKind && timings[step.node] !== undefined) return timings[step.node];
    const end = exchange.steps[i + 1]?.at ?? (running ? now : exchange.finishedAt);
    return end === undefined ? undefined : end - step.at;
  };

  if (!running && exchange.steps.length === 0) return null;

  const list = (
    <ol className="space-y-px" aria-live={running ? "polite" : undefined}>
      {exchange.steps.map((step, i) => {
        const current = running && i === exchange.steps.length - 1;
        // Judge and consistency run in parallel, so the step before the last may still be busy.
        const parallel =
          running && i === exchange.steps.length - 2 && ["judge", "consistency"].includes(step.node);
        const busy = current || parallel;
        const failed = exchange.status === "error" && i === exchange.steps.length - 1;
        const isRetry = step.node === "analyze" && i > 0;
        return (
          <li
            key={i}
            className={cn(
              "grid grid-cols-[1rem_minmax(0,1fr)_auto] items-baseline gap-x-2.5 py-1 text-sm",
              running && "arrive",
            )}
          >
            <span className="flex size-4 translate-y-[3px] items-center justify-center self-start">
              {busy ? (
                <span className="size-3 animate-spin rounded-full border-[1.5px] border-pencil/25 border-t-pencil" />
              ) : failed ? (
                <CircleXIcon className="size-3.5 text-halluc" />
              ) : isRetry ? (
                <RotateCcwIcon className="size-3.5 text-inferred" aria-label="Retry" />
              ) : (
                <CheckIcon className="size-3.5 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0">
              <span className={cn("font-medium", !busy && "text-foreground/80")}>
                {STEP_NAMES[step.node] ?? step.node}
              </span>
              <span className="text-muted-foreground"> · {step.message}</span>
            </span>
            <span className={cn("text-xs tabular-nums", busy ? "text-foreground" : "text-muted-foreground")}>
              {/* A parallel step still running has no honest time yet. */}
              {!parallel && timeOf(i) !== undefined ? seconds(timeOf(i)!) : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );

  if (running) {
    return (
      <div className="rounded-lg border border-dashed border-pencil/35 bg-sheet/60 px-4 py-3">
        <p className="flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground">
          <span>
            Agent working · step {exchange.steps.length}
            {retries > 0 && `, search rewritten ${retries === 1 ? "once" : `${retries} times`}`}
          </span>
          <span className="tabular-nums">{seconds(Math.max(0, now - exchange.startedAt))}</span>
        </p>
        <AgentRoute exchange={exchange} />
        <div className="mt-2 border-t border-rule pt-2">{list}</div>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className="-mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        <ChevronDownIcon
          className={cn("size-3.5 transition-transform duration-200 ease-(--ease-out)", open && "rotate-180")}
        />
        Agent took {exchange.steps.length} {exchange.steps.length === 1 ? "step" : "steps"} in {seconds(total)}
        {retries > 0 && ` · rewrote the search ${retries === 1 ? "once" : `${retries} times`}`}
      </button>
      <div className="disclosure" data-open={open} id={listId} inert={!open}>
        <div>
          <div className="mt-1.5 rounded-lg border border-rule px-4 py-3">
            <AgentRoute exchange={exchange} />
            <div className="mt-2 border-t border-rule pt-2">{list}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

type StageState = "done" | "busy" | "pending" | "skipped" | "failed";

/** The agent's route as a track of its stages, filled in the pencil as it advances. Judge and
 *  Compare run in parallel, so they share a stage as a fork; a rewritten search is drawn as a loop
 *  back to Plan. Names come from STEP_NAMES, the fixed step vocabulary. */
function AgentRoute({ exchange }: { exchange: Exchange }) {
  const running = exchange.status === "running";
  const steps = exchange.steps;
  const last = steps.at(-1)?.node;
  const busyNodes = new Set<string>();
  if (running && last) {
    busyNodes.add(last);
    const before = steps.at(-2)?.node;
    if (before && ["judge", "consistency"].includes(before) && ["judge", "consistency"].includes(last)) {
      busyNodes.add(before);
    }
  }
  const seen = new Set(steps.map((s) => s.node));
  const retries = steps.filter((s) => s.node === "analyze").length - 1;

  const stateOf = (node: string): StageState => {
    if (exchange.status === "error" && node === last) return "failed";
    if (busyNodes.has(node)) return "busy";
    if (seen.has(node)) return "done";
    return running ? "pending" : "skipped";
  };

  const stages: string[][] = [
    ["analyze"],
    ["retrieve"],
    ["generate"],
    ["extract"],
    ["verify"],
    ["judge", "consistency"],
    ["score"],
    ...(exchange.safeMode ? [["revise"]] : []),
  ];
  const n = stages.length;
  // How far along the route the pencil line reaches: the last stage started.
  const reached = stages.reduce((at, nodes, i) => (nodes.some((node) => seen.has(node)) ? i : at), -1);
  const progress = n > 1 ? Math.max(0, reached) / (n - 1) : 0;
  const inset = `${50 / n}%`; // the line runs from the first stage's centre to the last one's

  return (
    <div className={cn("relative mt-3", retries > 0 && "pt-5")} aria-hidden>
      {retries > 0 && (
        // The search was rewritten: a loop from Search back to Plan.
        <svg
          className="absolute top-0 h-6 overflow-visible text-inferred"
          style={{ left: inset, width: `${100 / n}%` }}
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          fill="none"
        >
          <path d="M100 22 C 100 4, 0 4, 0 22" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {retries > 0 && (
        <span
          className="absolute top-0 -translate-x-1/2 -translate-y-1 rounded-[4px] bg-sheet px-1 text-[10.5px] font-medium text-inferred tabular-nums"
          style={{ left: `${100 / n}%` }}
        >
          search rewritten{retries > 1 ? ` ×${retries}` : ""}
        </span>
      )}
      <div className="absolute top-[9px] h-0.5 rounded-full bg-rule" style={{ left: inset, right: inset }} />
      <div
        className="absolute top-[9px] h-0.5 origin-left rounded-full bg-pencil transition-transform duration-500 ease-(--ease-out)"
        style={{ left: inset, right: inset, transform: `scaleX(${progress})` }}
      />
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {stages.map((nodes) => (
          <li key={nodes[0]} className="flex flex-col items-center gap-1.5 px-0.5 text-center">
            <span className="flex h-5 items-center gap-1">
              {nodes.map((node) => (
                <StageDot key={node} state={stateOf(node)} small={nodes.length > 1} />
              ))}
            </span>
            <span className="hidden flex-col text-[11px] leading-[1.25] sm:flex">
              {nodes.map((node) => (
                <span
                  key={node}
                  className={cn(
                    stateOf(node) === "busy" ? "font-medium text-pencil" : "text-muted-foreground",
                    stateOf(node) === "skipped" && "opacity-55",
                  )}
                >
                  {STEP_NAMES[node]}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StageDot({ state, small }: { state: StageState; small: boolean }) {
  const size = small ? "size-3.5" : "size-[18px]";
  if (state === "done")
    return (
      <span className={cn(size, "flex items-center justify-center rounded-full bg-pencil text-primary-foreground")}>
        <CheckIcon className={small ? "size-2.5" : "size-3"} strokeWidth={3} />
      </span>
    );
  if (state === "busy")
    return (
      <span className={cn(size, "stage-live flex items-center justify-center rounded-full border-2 border-pencil bg-sheet")}>
        <span className="size-1.5 rounded-full bg-pencil" />
      </span>
    );
  if (state === "failed")
    return (
      <span className={cn(size, "flex items-center justify-center rounded-full bg-foreground text-background")}>
        <XIcon className={small ? "size-2.5" : "size-3"} strokeWidth={3} />
      </span>
    );
  return (
    <span
      className={cn(
        size,
        "rounded-full border-[1.5px] bg-sheet",
        state === "skipped" ? "border-dashed border-input" : "border-input",
      )}
    />
  );
}

/** The current time, ticking every tenth of a second while the agent works. */
function useNow(ticking: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}
