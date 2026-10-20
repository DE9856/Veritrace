"use client";

import { ArrowUpIcon, ShieldCheckIcon, SquareIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
      className="rounded-xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40"
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
        maxLength={2000}
        className="min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <label htmlFor="safe-mode" className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Switch id="safe-mode" checked={safeMode} onCheckedChange={setSafeMode} />
              <ShieldCheckIcon className="size-3.5" /> Safe mode
            </label>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            If any claim is flagged, also get a rewritten answer without it.
          </TooltipContent>
        </Tooltip>
        {running ? (
          <Button type="button" size="sm" variant="outline" onClick={onStop}>
            <SquareIcon /> Stop
          </Button>
        ) : (
          <Button type="submit" size="icon-sm" disabled={!canSend} aria-label="Ask">
            <ArrowUpIcon />
          </Button>
        )}
      </div>
    </form>
  );
}
