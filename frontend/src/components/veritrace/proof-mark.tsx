import type { Label } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The checker's marks: a tick for stated, a tilde for inferred (it follows, but not in these
 *  words) and a strike for possibly hallucinated. Drawn rather than taken from an icon font so
 *  they can draw themselves when a verdict lands. */
const PATHS: Record<Label, string[]> = {
  high: ["M3.5 8.5 6.6 11.6 12.5 4.5"],
  inferred: ["M2.5 9.2C4.4 6.4 6 6.4 8 8s3.6 1.6 5.5-1.2"],
  hallucinated: ["M4 4l8 8", "M12 4l-8 8"],
};

export const LABEL_TONE: Record<Label, string> = {
  high: "text-high",
  inferred: "text-inferred",
  hallucinated: "text-halluc",
};

export function ProofMark({
  label,
  className,
  animate = false,
  delay = 0,
}: {
  label: Label;
  className?: string;
  animate?: boolean;
  delay?: number;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-4 shrink-0", LABEL_TONE[label], animate && "proof-mark", className)}
      style={animate ? ({ "--delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {PATHS[label].map((d) => (
        <path key={d} d={d} pathLength={1} />
      ))}
    </svg>
  );
}
