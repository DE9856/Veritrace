"use client";

import { ArrowUpIcon, ShieldCheckIcon, SquareIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 2000;

export function Composer({
  running,
  disabledReason,
  onAsk,
  onStop,
}: {
  running: boolean;
  disabledReason: string | null;
  onAsk: (question: string, safeMode: boolean) => void;
  onStop: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [safeMode, setSafeMode] = useState(false);
  const canSend = question.trim().length > 0 && !running && !disabledReason;
  const nearLimit = question.length > MAX_LENGTH - 200;

  const send = () => {
    if (!canSend) return;
    onAsk(question.trim(), safeMode);
    setQuestion("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={cn(
        "rounded-lg border border-input bg-sheet p-1.5 transition-[border-color,box-shadow] duration-150",
        "focus-within:border-pencil/60 focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--pencil)_14%,transparent)]",
        disabledReason && "bg-sheet/60",
      )}
    >
      <label htmlFor="question" className="sr-only">
        Your question
      </label>
      <Textarea
        id="question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={disabledReason ?? "Ask about your documents…"}
        disabled={!!disabledReason}
        rows={2}
        maxLength={MAX_LENGTH}
        aria-describedby="question-hint"
        className="max-h-48 min-h-12 resize-none border-0 bg-transparent px-2.5 text-base shadow-none focus-visible:ring-0 disabled:bg-transparent md:text-[15px] dark:bg-transparent dark:disabled:bg-transparent"
      />
      <div className="flex items-center justify-between gap-2 pt-1 pl-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <label
              htmlFor="safe-mode"
              className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground has-data-checked:text-foreground"
            >
              <Switch id="safe-mode" checked={safeMode} onCheckedChange={setSafeMode} />
              <ShieldCheckIcon className="size-3.5" /> Safe mode
            </label>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            If any claim is flagged, also get a rewritten answer without it.
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-3">
          {nearLimit && (
            <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {question.length} / {MAX_LENGTH}
            </span>
          )}
          {running ? (
            <Button type="button" size="sm" variant="outline" onClick={onStop}>
              <SquareIcon className="fill-current" /> Stop
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              disabled={!canSend}
              aria-label="Ask"
              className="disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100"
            >
              <ArrowUpIcon />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
