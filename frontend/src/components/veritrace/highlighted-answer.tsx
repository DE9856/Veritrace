"use client";

import { useState } from "react";

import { LABEL_TEXT, numberClaims } from "@/lib/labels";
import type { SentenceResult, SourceChunk } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CitedText } from "./cited-text";

/** The checked answer: each sentence underlined in the colour (and style) of its weakest claim and
 *  followed by the numbers of its claims, which the threshold scale and the claim list use too.
 *  Selecting a sentence opens its claims in the claim panel and steps the rest of the answer back.
 *  Hover can be shared with the scale and the list; with `interactive` off it is a specimen (the
 *  worked example) and selects nothing. */
export function HighlightedAnswer({
  sentences,
  selected = null,
  onSelect,
  onCite,
  sources,
  hover: sharedHover,
  onHover,
  interactive = true,
  className,
}: {
  sentences: SentenceResult[];
  selected?: number | null;
  onSelect?: (index: number) => void;
  onCite?: (label: string) => void;
  sources?: SourceChunk[];
  hover?: number | null;
  onHover?: (index: number | null) => void;
  interactive?: boolean;
  className?: string;
}) {
  const [ownHover, setOwnHover] = useState<number | null>(null);
  const hover = sharedHover !== undefined ? sharedHover : ownHover;
  const setHover = onHover ?? setOwnHover;
  const numbers = numberClaims(sentences);
  const checked = sentences.filter((s) => s.claims.length > 0 && s.label);
  // Each sentence's underline lands in reading order, in step with its claims on the scale.
  const landing = new Map(checked.map((s, i) => [s.index, i * 90]));

  return (
    <p className={cn("max-w-[40rem] text-[1.1875rem] leading-[1.7] text-pretty sm:text-[1.25rem]", className)}>
      {sentences.map((sentence) => {
        const label = sentence.label ?? "none";
        const checkable = interactive && sentence.claims.length > 0;
        const claimNumbers = numbers.get(sentence.index) ?? [];
        return (
          <span key={sentence.index}>
            <span
              className="sentence sentence-land"
              style={{ "--delay": `${landing.get(sentence.index) ?? 0}ms` } as React.CSSProperties}
              data-label={label}
              data-hover={hover === sentence.index}
              data-dim={selected !== null && selected !== sentence.index}
              role={checkable ? "button" : undefined}
              tabIndex={checkable ? 0 : undefined}
              aria-pressed={checkable ? selected === sentence.index : undefined}
              aria-label={
                checkable
                  ? `${LABEL_TEXT[sentence.label!]}: claim${claimNumbers.length === 1 ? "" : "s"} ${claimNumbers.join(", ")}. Show the claim check.`
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
            </span>
            {/* Outside the sentence, so its underline does not run under the numbers. */}
            {claimNumbers.length > 0 && (
              <sup
                aria-hidden
                className={cn(
                  "figures ml-px text-[11px] font-bold tracking-wide text-muted-foreground transition-opacity duration-200 font-stretch-75%",
                  selected !== null && selected !== sentence.index && "opacity-40",
                )}
              >
                {claimNumbers.join(",")}
              </sup>
            )}{" "}
          </span>
        );
      })}
    </p>
  );
}
