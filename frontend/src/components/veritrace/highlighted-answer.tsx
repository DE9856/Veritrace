"use client";

import { LABEL_TEXT } from "@/lib/labels";
import type { SentenceResult } from "@/lib/types";

import { CitedText } from "./cited-text";

/** The checked answer: each sentence highlighted by the label of its weakest claim.
 *  Selecting a sentence opens its claims in the inspector. */
export function HighlightedAnswer({
  sentences,
  selected,
  onSelect,
  onCite,
}: {
  sentences: SentenceResult[];
  selected: number | null;
  onSelect: (index: number) => void;
  onCite: (label: string) => void;
}) {
  return (
    <p className="text-[1.0625rem] leading-[1.95]">
      {sentences.map((sentence) => {
        const label = sentence.label ?? "none";
        const checkable = sentence.claims.length > 0;
        return (
          <span key={sentence.index}>
            <span
              className="sentence"
              data-label={label}
              role={checkable ? "button" : undefined}
              tabIndex={checkable ? 0 : undefined}
              aria-pressed={checkable ? selected === sentence.index : undefined}
              aria-label={
                checkable
                  ? `${LABEL_TEXT[sentence.label!]}: ${sentence.claims.length} claim${sentence.claims.length === 1 ? "" : "s"}. Show details.`
                  : undefined
              }
              onClick={checkable ? () => onSelect(sentence.index) : undefined}
              onKeyDown={
                checkable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(sentence.index);
                      }
                    }
                  : undefined
              }
            >
              <CitedText text={sentence.text} onCite={onCite} />
            </span>{" "}
          </span>
        );
      })}
    </p>
  );
}
