"use client";

import { useLayoutEffect, useRef, useState } from "react";

import {
  HIGH_CUTOFF,
  INFERRED_CUTOFF,
  LABEL_TEXT,
  percent,
} from "@/lib/labels";
import type { Label } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ScaleClaim {
  n: number; // the claim's number in the answer
  sentence: number; // the sentence it belongs to
  label: Label;
  score: number;
}

const ZONES: { label: Label; from: number; to: number; tone: string }[] = [
  { label: "hallucinated", from: 0, to: INFERRED_CUTOFF, tone: "bg-halluc/20" },
  {
    label: "inferred",
    from: INFERRED_CUTOFF,
    to: HIGH_CUTOFF,
    tone: "bg-inferred/20",
  },
  { label: "high", from: HIGH_CUTOFF, to: 1, tone: "bg-high/20" },
];

const TICK_TONE: Record<Label, string> = {
  high: "bg-high",
  inferred: "bg-inferred",
  hallucinated: "bg-halluc",
};

const LABEL_GAP = 20; // px between the centres of two claim numbers
const TICK_TOP = 12; // px: the ramp starts below the confidence pointer
const TICK_HEIGHT = 20;
const LEADER = 16; // px of leader line between the ticks and the row of numbers

/** The threshold scale: every claim as a tick at its exact score on one fixed 0 to 100 ramp, against
 *  the two cut-offs the labels come from, with the answer's confidence marked above. The claim
 *  numbers sit in a row beneath, spread apart so they never touch, each joined to its tick by a
 *  leader line, so claims with close scores stay readable however they cluster. Hovering a claim
 *  lights its sentence (and the reverse); selecting one opens its claim check. The sentences and the
 *  claim list stay the keyboard path, so the scale is a pointer shortcut. */
export function VerdictScale({
  claims,
  confidence,
  hover,
  onHover,
  selected,
  onSelect,
  animate = true,
  className,
}: {
  claims: ScaleClaim[];
  confidence: number | null;
  hover?: number | null;
  onHover?: (sentence: number | null) => void;
  selected?: number | null;
  onSelect?: (sentence: number) => void;
  animate?: boolean;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const placed = spread(claims, width);
  const order = new Map(claims.map((c, i) => [c.n, i]));
  const labelsTop = TICK_TOP + TICK_HEIGHT + LEADER;

  return (
    <figure className={cn("select-none", className)}>
      <div
        ref={track}
        className="relative"
        style={{ height: labelsTop + 16 }}
        aria-hidden
      >
        {confidence !== null && (
          <div
            className="absolute top-0 size-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-foreground"
            style={{ left: `${confidence * 100}%` }}
            title={`Answer confidence ${percent(confidence)}`}
          />
        )}
        <div className="absolute inset-x-0 flex h-2" style={{ top: TICK_TOP }}>
          {ZONES.map((zone) => (
            <div
              key={zone.label}
              className={zone.tone}
              style={{ width: `${(zone.to - zone.from) * 100}%` }}
            />
          ))}
        </div>
        {[INFERRED_CUTOFF, HIGH_CUTOFF].map((cut) => (
          <div
            key={cut}
            className="absolute w-px bg-foreground/50"
            style={{
              left: `${cut * 100}%`,
              top: TICK_TOP,
              height: TICK_HEIGHT + 4,
            }}
          />
        ))}

        {/* Leader lines from each tick down to its spread-out number. */}
        {width > 0 && (
          <svg
            className="pointer-events-none absolute inset-x-0 overflow-visible"
            style={{ top: TICK_TOP + TICK_HEIGHT }}
            width={width}
            height={LEADER}
          >
            {claims.map((claim) => {
              const from = claim.score * width;
              const to = placed.get(claim.n) ?? from;
              const faded = hover != null && hover !== claim.sentence;
              return (
                <path
                  key={claim.n}
                  d={`M${from} 0 V${LEADER * 0.35} L${to} ${LEADER}`}
                  fill="none"
                  strokeWidth={1}
                  className={cn(
                    "stroke-foreground/45 transition-opacity duration-150",
                    faded && "opacity-30",
                    animate && "fade-swap",
                  )}
                />
              );
            })}
          </svg>
        )}

        {claims.map((claim) => {
          const lit = hover === claim.sentence || selected === claim.sentence;
          const faded = hover != null && hover !== claim.sentence;
          const handlers = {
            onMouseEnter: onHover ? () => onHover(claim.sentence) : undefined,
            onMouseLeave: onHover ? () => onHover(null) : undefined,
            onClick: onSelect ? () => onSelect(claim.sentence) : undefined,
          };
          const title = `Claim ${claim.n}: ${LABEL_TEXT[claim.label]}, score ${percent(claim.score)}`;
          const x = placed.get(claim.n);
          return (
            <div
              key={claim.n}
              className={cn(
                "transition-opacity duration-150",
                faded && "opacity-30",
              )}
            >
              {/* The tick, on a full-width layer that slides in from zero when the verdict lands. */}
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-0",
                  animate && "scale-tick",
                )}
                style={
                  {
                    top: TICK_TOP,
                    "--from": `-${claim.score * 100}%`,
                    "--delay": `${(order.get(claim.n) ?? 0) * 90}ms`,
                  } as React.CSSProperties
                }
              >
                <div
                  {...handlers}
                  title={title}
                  className={cn(
                    "pointer-events-auto absolute -translate-x-1/2 transition-[width] duration-150",
                    TICK_TONE[claim.label],
                    onSelect && "cursor-pointer",
                    lit ? "w-[5px]" : "w-[3px]",
                  )}
                  style={{ left: `${claim.score * 100}%`, height: TICK_HEIGHT }}
                />
              </div>
              {/* The number, in the spread-out row beneath. */}
              <span
                {...handlers}
                title={title}
                className={cn(
                  "figures absolute flex h-4 min-w-4 -translate-x-1/2 items-center justify-center px-0.5 text-[12px] leading-none font-bold font-stretch-75%",
                  onSelect && "cursor-pointer",
                  selected === claim.sentence &&
                    "bg-signal text-primary-foreground",
                  animate && "fade-swap",
                )}
                style={{
                  top: labelsTop,
                  left: x !== undefined ? x : `${claim.score * 100}%`,
                }}
              >
                {claim.n}
              </span>
            </div>
          );
        })}
      </div>
      <div
        className="figures relative mt-1 h-4 text-[11px] text-muted-foreground"
        aria-hidden
      >
        {[0, INFERRED_CUTOFF, HIGH_CUTOFF, 1].map((mark) => (
          <span
            key={mark}
            className={cn(
              "absolute",
              mark === 0
                ? "left-0"
                : mark === 1
                  ? "right-0"
                  : "-translate-x-1/2",
            )}
            style={
              mark > 0 && mark < 1 ? { left: `${mark * 100}%` } : undefined
            }
          >
            {percent(mark)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        Claim scores on a 0 to 100 scale. Below {percent(INFERRED_CUTOFF)} a
        claim is possibly hallucinated, from {percent(INFERRED_CUTOFF)} it is
        inferred, and from {percent(HIGH_CUTOFF)} it is high confidence.{" "}
        {claims
          .map(
            (c) =>
              `Claim ${c.n}: ${percent(c.score)}, ${LABEL_TEXT[c.label].toLowerCase()}.`,
          )
          .join(" ")}
      </figcaption>
    </figure>
  );
}

/** Where each claim's number goes along the row beneath the ramp, in px: as close to its tick as
 *  it can be while staying LABEL_GAP from its neighbours (less only when that many cannot fit) and
 *  inside the scale. Numbers that
 *  would collide are gathered into a run centred on their ticks' average, and runs that then touch
 *  are merged, so a cluster fans out evenly around where it really sits. */
function spread(claims: ScaleClaim[], width: number): Map<number, number> {
  const placed = new Map<number, number>();
  if (width <= 0) return placed;
  // Many claims on a narrow scale: close the gap so the whole row still fits inside it.
  const gap = Math.min(
    LABEL_GAP,
    Math.max(12, (width - LABEL_GAP) / Math.max(1, claims.length - 1)),
  );
  const half = LABEL_GAP / 2;
  const sorted = [...claims].sort((a, b) => a.score - b.score || a.n - b.n);
  // Each run: the claims in it and where their ideal positions average.
  let runs = sorted.map((c) => ({ items: [c], centre: c.score * width }));
  const startOf = (run: { items: ScaleClaim[]; centre: number }) => {
    const span = (run.items.length - 1) * gap;
    return Math.min(Math.max(run.centre - span / 2, half), width - half - span);
  };
  let merged = true;
  while (merged) {
    merged = false;
    const next: typeof runs = [];
    for (const run of runs) {
      const prev = next.at(-1);
      if (
        prev &&
        startOf(prev) + (prev.items.length - 1) * gap + gap > startOf(run)
      ) {
        const items = [...prev.items, ...run.items];
        next[next.length - 1] = {
          items,
          centre:
            items.reduce((sum, c) => sum + c.score * width, 0) / items.length,
        };
        merged = true;
      } else next.push(run);
    }
    runs = next;
  }
  for (const run of runs) {
    const start = startOf(run);
    run.items.forEach((c, i) => placed.set(c.n, start + i * gap));
  }
  return placed;
}
