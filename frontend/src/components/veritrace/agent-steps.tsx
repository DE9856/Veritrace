"use client";

import { ChevronDownIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { Exchange } from "@/hooks/use-chat";
import { STEP_NAMES, seconds } from "@/lib/labels";
import { cn } from "@/lib/utils";

type StageState = "done" | "busy" | "pending" | "skipped" | "failed";

/** The agent's route through its stages, in the margin beside the answer: a live timetable with a
 *  running clock while it works, a one-line summary that opens to the same table after. */
export function AgentSteps({ exchange }: { exchange: Exchange }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const running = exchange.status === "running";
  const now = useNow(running);
  const total = (exchange.finishedAt ?? exchange.startedAt) - exchange.startedAt;
  const retries = exchange.steps.filter((s) => s.node === "analyze").length - 1;

  if (!running && exchange.steps.length === 0) return null;

  if (running) {
    return (
      <div className="space-y-5" aria-live="polite">
        <div>
          <p className="figures text-[3.5rem] leading-[0.85] font-extrabold tracking-[-0.02em] font-stretch-62%">
            {seconds(Math.max(0, now - exchange.startedAt))}
          </p>
          <p className="caps mt-2 text-muted-foreground">
            Checking · step {exchange.steps.length}
            {retries > 0 && `, search rewritten ${retries === 1 ? "once" : `${retries} times`}`}
          </p>
        </div>
        <StageTable exchange={exchange} now={now} />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center gap-2 border-b border-rule py-2 text-left text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <span className="flex-1">
          Agent: {exchange.steps.length} {exchange.steps.length === 1 ? "step" : "steps"} in {seconds(total)}
          {retries > 0 && `, search rewritten ${retries === 1 ? "once" : `${retries} times`}`}
        </span>
        <ChevronDownIcon
          className={cn("size-3.5 transition-transform duration-200 ease-(--ease-out)", open && "rotate-180")}
        />
      </button>
      <div className="disclosure" data-open={open} id={listId} inert={!open}>
        <div>
          <StageTable exchange={exchange} now={now} className="pt-4" />
        </div>
      </div>
    </div>
  );
}

/** One row per stage in the order a normal run visits them, joined by a rule: a filled square when
 *  done, a live signal square while busy, hollow while pending, dashed when the run skipped it.
 *  Judge and Compare run in parallel and are bracketed together. */
function StageTable({ exchange, now, className }: { exchange: Exchange; now: number; className?: string }) {
  const running = exchange.status === "running";
  const steps = exchange.steps;
  const timings = exchange.response?.timings_ms ?? {};
  const last = steps.at(-1)?.node;
  const busy = new Set<string>();
  if (running && last) {
    busy.add(last);
    const before = steps.at(-2)?.node;
    if (before && ["judge", "consistency"].includes(before) && ["judge", "consistency"].includes(last)) busy.add(before);
  }
  const seen = new Set(steps.map((s) => s.node));
  const retries = steps.filter((s) => s.node === "analyze").length - 1;
  const stateOf = (node: string): StageState => {
    if (exchange.status === "error" && node === last) return "failed";
    if (busy.has(node)) return "busy";
    if (seen.has(node)) return "done";
    return running ? "pending" : "skipped";
  };
  // A stage's time: the backend's measurement once the answer arrives, otherwise the gap until the
  // next step began (or until now, for a stage still running). A parallel stage has no honest time
  // until it ends.
  const timeOf = (node: string) => {
    const i = steps.findLastIndex((s) => s.node === node);
    if (i === -1) return undefined;
    if (timings[node] !== undefined) return timings[node];
    if (busy.has(node) && busy.size > 1) return undefined;
    const end = steps[i + 1]?.at ?? (running ? now : exchange.finishedAt);
    return end === undefined ? undefined : end - steps[i].at;
  };
  const messageOf = (node: string) => steps.findLast((s) => s.node === node)?.message;

  const nodes = ["analyze", "retrieve", "generate", "extract", "verify", "judge", "consistency", "score"];
  if (exchange.safeMode) nodes.push("revise");

  return (
    <ol className={cn("relative", className)}>
      {/* The rule the stages hang on. */}
      <span aria-hidden className="absolute top-2 bottom-2 left-[4.5px] w-px bg-border" />
      {nodes.map((node) => {
        const state = stateOf(node);
        const time = timeOf(node);
        const parallel = node === "judge" || node === "consistency";
        return (
          <li
            key={node}
            className="relative grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-x-3 py-1.5 text-[13.5px]"
          >
            <StageSquare state={state} />
            <span className="min-w-0">
              <span
                className={cn(
                  state === "busy" && "font-semibold",
                  state === "skipped" && "text-muted-foreground/70",
                  state === "pending" && "text-muted-foreground",
                )}
              >
                {STEP_NAMES[node]}
              </span>
              {parallel && <span className="ml-1.5 text-[11.5px] text-muted-foreground">in parallel</span>}
              {node === "retrieve" && retries > 0 && (
                <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                  <RotateCcwIcon className="size-3" aria-hidden /> Search rewritten
                  {retries > 1 ? ` ${retries} times` : ""}
                </span>
              )}
              {state === "busy" && messageOf(node) && (
                <span className="arrive mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
                  {messageOf(node)}
                </span>
              )}
            </span>
            <span className={cn("figures text-[12px]", state === "busy" ? "text-foreground" : "text-muted-foreground")}>
              {time !== undefined && state !== "pending" ? seconds(time) : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StageSquare({ state }: { state: StageState }) {
  const base = "relative z-10 mt-[3px] size-2.5 self-start";
  if (state === "done") return <span className={cn(base, "bg-foreground")} />;
  if (state === "busy") return <span className={cn(base, "stage-live bg-signal")} />;
  if (state === "failed")
    return (
      <span className={cn(base, "flex items-center justify-center bg-foreground text-background")}>
        <XIcon className="size-2" strokeWidth={4} />
      </span>
    );
  return (
    <span
      className={cn(base, "border bg-background", state === "skipped" ? "border-dashed border-input" : "border-input")}
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
