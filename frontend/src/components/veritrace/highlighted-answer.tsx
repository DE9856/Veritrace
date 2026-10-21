"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { LABEL_TEXT, percent } from "@/lib/labels";
import type { SentenceResult, SourceChunk } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CitedText } from "./cited-text";
import { ProofMark } from "./proof-mark";

const MARK_HEIGHT = 22; // px; marks closer than this are pushed down so they never overlap

/** The checked answer, set like a fact-checker's galley proof: each sentence underlined in the
 *  colour of its weakest claim, and a ruled margin in the editor's blue pencil that numbers the
 *  lines and carries each sentence's mark and score on the line where it runs. Selecting a
 *  sentence (or its mark) opens its claims in the inspector. Hover can be shared with the claim
 *  strip above it; with `interactive` off it is a specimen (the worked examples) and selects
 *  nothing. */
export function HighlightedAnswer({
  sentences,
  selected = null,
  onSelect,
  onCite,
  sources,
  hover: sharedHover,
  onHover,
  interactive = true,
}: {
  sentences: SentenceResult[];
  selected?: number | null;
  onSelect?: (index: number) => void;
  onCite?: (label: string) => void;
  sources?: SourceChunk[];
  hover?: number | null;
  onHover?: (index: number | null) => void;
  interactive?: boolean;
}) {
  const text = useRef<HTMLParagraphElement>(null);
  const spans = useRef(new Map<number, HTMLSpanElement>());
  const [tops, setTops] = useState<Record<number, number>>({});
  const [lines, setLines] = useState<number[]>([]); // the centre of each line of the answer
  const [ownHover, setOwnHover] = useState<number | null>(null);
  const hover = sharedHover !== undefined ? sharedHover : ownHover;
  const setHover = onHover ?? setOwnHover;

  // Place each mark level with the first line of its sentence, and re-place on every reflow.
  useLayoutEffect(() => {
    const container = text.current;
    if (!container) return;
    const place = () => {
      const origin = container.getBoundingClientRect().top;
      const next: Record<number, number> = {};
      let floor = -Infinity;
      const width = container.clientWidth;
      // Every line box the sentences occupy, so the margin can number them like a galley.
      const centres = new Map<number, number>();
      for (const el of spans.current.values()) {
        for (const r of el.getClientRects()) {
          if (r.width < 1) continue;
          centres.set(Math.round((r.top - origin) / 6), r.top - origin + r.height / 2);
        }
      }
      setLines([...centres.values()].sort((a, b) => a - b));
      for (const sentence of sentences) {
        const rects = spans.current.get(sentence.index)?.getClientRects();
        // A sentence that only begins in the tail of a line ("…1968. The") is marked on the line
        // where it actually runs.
        const first = rects && rects.length > 1 && rects[0].width < width * 0.25 ? rects[1] : rects?.[0];
        if (!first || sentence.claims.length === 0) continue;
        // Centre the mark on the line box, then keep it clear of the mark above.
        const top = Math.max(first.top - origin + (first.height - MARK_HEIGHT) / 2, floor);
        next[sentence.index] = top;
        floor = top + MARK_HEIGHT;
      }
      setTops(next);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(container);
    return () => observer.disconnect();
  }, [sentences]);

  const checked = sentences.filter((s) => s.claims.length > 0 && s.label);
  // Each sentence's underline lands with its margin mark, in reading order.
  const landing = new Map(checked.map((s, i) => [s.index, i * 90]));

  return (
    <div
      className={cn(
        "grid gap-x-3 sm:gap-x-5",
        // No rail when nothing was checked, such as "the documents don't contain this".
        checked.length > 0 && "grid-cols-[minmax(0,1fr)_3.25rem] sm:grid-cols-[minmax(0,1fr)_5.5rem]",
      )}
    >
      <p ref={text} className="font-serif text-[1.0625rem] leading-[1.85] text-pretty sm:text-lg sm:leading-[1.8]">
        {sentences.map((sentence) => {
          const label = sentence.label ?? "none";
          const checkable = interactive && sentence.claims.length > 0;
          return (
            <span key={sentence.index}>
              <span
                ref={(el) => {
                  if (el) spans.current.set(sentence.index, el);
                  else spans.current.delete(sentence.index);
                }}
                className="sentence sentence-land"
                style={{ "--delay": `${landing.get(sentence.index) ?? 0}ms` } as React.CSSProperties}
                data-label={label}
                data-hover={hover === sentence.index}
                role={checkable ? "button" : undefined}
                tabIndex={checkable ? 0 : undefined}
                aria-pressed={checkable ? selected === sentence.index : undefined}
                aria-label={
                  checkable
                    ? `${LABEL_TEXT[sentence.label!]}: ${sentence.claims.length} claim${sentence.claims.length === 1 ? "" : "s"}. Show details.`
                    : undefined
                }
                onMouseEnter={checkable ? () => setHover(sentence.index) : undefined}
                onMouseLeave={checkable ? () => setHover(null) : undefined}
                onClick={checkable ? () => onSelect?.(sentence.index) : undefined}
                onKeyDown={
                  checkable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect?.(sentence.index);
                        }
                      }
                    : undefined
                }
              >
                <CitedText text={sentence.text} onCite={interactive ? onCite : undefined} sources={sources} />
              </span>{" "}
            </span>
          );
        })}
      </p>

      {/* The margin rail. It repeats what the sentences already say to assistive technology, so it
          is a pointer shortcut only; the sentences stay the keyboard targets. */}
      {checked.length > 0 && (
        <div className="relative border-l-[3px] border-double border-pencil/45" aria-hidden>
          {/* Galley line numbers, for referring to a line ("line 3") and for the proof's rhythm. */}
          {lines.map((centre, n) => (
            <span
              key={n}
              className="absolute left-2 hidden -translate-y-1/2 text-[10.5px] text-pencil/70 tabular-nums sm:block"
              style={{ top: centre }}
            >
              {n + 1}
            </span>
          ))}
          {checked.map((sentence, i) => {
            const top = tops[sentence.index];
            if (top === undefined) return null;
            const weakest = Math.min(...sentence.claims.map((c) => c.score));
            const active = selected === sentence.index;
            return (
              <div
                key={sentence.index}
                onClick={interactive ? () => onSelect?.(sentence.index) : undefined}
                onMouseEnter={interactive ? () => setHover(sentence.index) : undefined}
                onMouseLeave={interactive ? () => setHover(null) : undefined}
                className={cn(
                  "absolute left-0 flex h-[22px] w-full items-center",
                  interactive && "cursor-pointer",
                  "gap-1.5 pl-2.5 transition-colors duration-150 sm:pl-8",
                  "before:absolute before:inset-y-0.5 before:-left-[3px] before:w-[3px] before:rounded-full before:bg-pencil before:opacity-0 before:transition-opacity",
                  hover === sentence.index && !active && "before:opacity-100",
                )}
                style={{ top }}
                title={`${LABEL_TEXT[sentence.label!]}, score ${percent(weakest)}`}
              >
                {/* The selected sentence's mark inverts, tying the margin to the open inspector. */}
                <span
                  className={cn(
                    "-ml-1 flex h-full items-center gap-1.5 rounded-[5px] px-1 transition-colors duration-150",
                    active && "bg-pencil",
                  )}
                >
                  <ProofMark
                    label={sentence.label!}
                    animate
                    delay={i * 90}
                    className={active ? "text-primary-foreground" : undefined}
                  />
                  <span
                    className={cn(
                      "proof-mark-score text-[13px] tabular-nums",
                      active ? "font-medium text-primary-foreground" : "text-muted-foreground",
                    )}
                    style={{ "--delay": `${i * 90}ms` } as React.CSSProperties}
                  >
                    {percent(weakest)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
