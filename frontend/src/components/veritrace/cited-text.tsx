"use client";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { bestSentence } from "@/lib/evidence";
import type { SourceChunk } from "@/lib/types";
import { cn } from "@/lib/utils";

const CITATION = /\[(S\d+(?:\s*[,;]\s*S\d+)*)\]/g;

/** Plain answer text with every [S1] / [S2, S3] citation turned into a button, or into a plain
 *  marker where there is nothing to open (a draft still streaming, a quoted claim). Given the
 *  sources, hovering a citation previews the passage line that best supports this text. */
export function CitedText({
  text,
  onCite,
  activeSource,
  sources,
}: {
  text: string;
  onCite?: (label: string) => void;
  activeSource?: string | null;
  sources?: SourceChunk[];
}) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(plain(text.slice(last, start).replace(/\s+$/, ""), last));
    for (const label of match[1].split(/\s*[,;]\s*/)) {
      parts.push(
        onCite ? (
          <CitationChip
            key={`${start}-${label}`}
            label={label}
            onCite={onCite}
            active={activeSource === label}
            source={sources?.find((s) => s.label === label)}
            context={text}
          />
        ) : (
          <span
            key={`${start}-${label}`}
            className="ml-0.5 inline-flex -translate-y-[0.45em] bg-signal-soft px-1 text-[11px] leading-4 font-bold text-signal tabular-nums"
          >
            {label}
          </span>
        ),
      );
    }
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(plain(text.slice(last), last));
  return <>{parts}</>;
}

/** A run of text; a run of bare punctuation (the full stop after a citation) is kept out of the
 *  sentence's underline, so no lone dot gets underlined. */
function plain(text: string, key: number): React.ReactNode {
  return /^[\s.,;:!?)\]]+$/.test(text) ? (
    <span key={`p${key}`} className="inline-block whitespace-pre">
      {text}
    </span>
  ) : (
    text
  );
}

export function CitationChip({
  label,
  onCite,
  active,
  source,
  context,
}: {
  label: string;
  onCite: (label: string) => void;
  active?: boolean;
  source?: SourceChunk;
  context?: string; // the sentence the citation sits in, to find the line that supports it
}) {
  const chip = (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onCite(label);
      }}
      className={cn(
        "ml-0.5 inline-flex -translate-y-[0.45em] items-center px-1 text-[11px] leading-4 font-bold tabular-nums",
        "bg-signal-soft text-signal transition-colors duration-150 hover:bg-signal hover:text-primary-foreground",
        active && "bg-signal text-primary-foreground",
      )}
      aria-label={`Open source ${label}`}
    >
      {label}
    </button>
  );
  if (!source) return chip;
  return (
    <HoverCard openDelay={350} closeDelay={80}>
      <HoverCardTrigger asChild>{chip}</HoverCardTrigger>
      <HoverCardContent side="top" className="w-[22rem] rounded-none border-2 border-foreground p-0 ring-0 shadow-[0_8px_24px_rgb(0_0_0/0.14)]">
        <PassagePreview source={source} context={context} />
      </HoverCardContent>
    </HoverCard>
  );
}

/** The passage behind a citation, trimmed to the line that best supports the cited text. */
function PassagePreview({ source, context }: { source: SourceChunk; context?: string }) {
  const { sentences, best } = bestSentence(source.text, context);
  const excerpt =
    best >= 0 ? sentences.slice(Math.max(0, best - 1), best + 2) : [source.text.slice(0, 240).trimEnd() + "…"];
  const focus = best >= 0 ? Math.min(best, 1) : -1;
  return (
    <div>
      <div className="flex items-baseline gap-2 border-b border-rule px-3.5 py-2 text-xs">
        <span className="bg-signal px-1 font-bold text-primary-foreground tabular-nums">
          {source.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {source.filename}, p. {source.page}
        </span>
        <span className="text-muted-foreground tabular-nums">match {source.similarity.toFixed(2)}</span>
      </div>
      <p className="px-3.5 py-3 text-[0.9375rem] leading-relaxed">
        {excerpt.map((sentence, i) => (
          <span
            key={i}
            className={
              i === focus
                ? "bg-signal-soft text-foreground underline decoration-signal/60 decoration-2 underline-offset-4"
                : "text-muted-foreground"
            }
          >
            {sentence}{" "}
          </span>
        ))}
      </p>
      <p className="border-t border-rule px-3.5 py-1.5 text-xs text-muted-foreground">
        Select the citation to open the whole passage.
      </p>
    </div>
  );
}
