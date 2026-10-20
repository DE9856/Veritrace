"use client";

import { cn } from "@/lib/utils";

const CITATION = /\[(S\d+(?:\s*[,;]\s*S\d+)*)\]/g;

/** Plain answer text with every [S1] / [S2, S3] citation turned into a button. */
export function CitedText({
  text,
  onCite,
  activeSource,
}: {
  text: string;
  onCite: (label: string) => void;
  activeSource?: string | null;
}) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start).replace(/\s+$/, ""));
    for (const label of match[1].split(/\s*[,;]\s*/)) {
      parts.push(
        <CitationChip key={`${start}-${label}`} label={label} onCite={onCite} active={activeSource === label} />,
      );
    }
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function CitationChip({
  label,
  onCite,
  active,
}: {
  label: string;
  onCite: (label: string) => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onCite(label);
      }}
      className={cn(
        "mx-0.5 inline-flex -translate-y-1.5 items-center rounded px-1 font-mono text-[10px] leading-4 font-medium",
        "bg-accent text-primary hover:bg-primary hover:text-primary-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "bg-primary text-primary-foreground",
      )}
      aria-label={`Open source ${label}`}
    >
      {label}
    </button>
  );
}
