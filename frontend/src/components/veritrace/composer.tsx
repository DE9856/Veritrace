"use client";

import { ArrowUpIcon, ClipboardCheckIcon, ShieldCheckIcon, SquareIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 2000;
const MAX_ANSWER_LENGTH = 8000; // the backend's limit for an answer to check

export function Composer({
  running,
  disabledReason,
  onAsk,
  onStop,
}: {
  running: boolean;
  disabledReason: string | null;
  onAsk: (question: string, safeMode: boolean, answer?: string) => void;
  onStop: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [safeMode, setSafeMode] = useState(false);
  // Check mode: the answer is given (written by hand, or by another model) and only checked.
  const [checking, setChecking] = useState(false);
  const [answer, setAnswer] = useState("");
  const answerField = useRef<HTMLTextAreaElement>(null);
  const complete = question.trim().length > 0 && (!checking || answer.trim().length > 0);
  const canSend = complete && !running && !disabledReason;
  const nearLimit = question.length > MAX_LENGTH - 200;

  const send = () => {
    if (!canSend) return;
    onAsk(question.trim(), safeMode, checking ? answer.trim() : undefined);
    setQuestion("");
    setAnswer("");
  };

  const onEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>, field: "question" | "answer") => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    // In check mode, Enter in the question moves on to the answer until both are filled in.
    if (field === "question" && checking && !answer.trim()) answerField.current?.focus();
    else send();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={cn(
        "border-2 border-foreground bg-sheet p-2 transition-[border-color,box-shadow] duration-150",
        "focus-within:border-signal focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--signal)_18%,transparent)]",
        disabledReason && "border-input bg-muted/40",
      )}
    >
      <label htmlFor="question" className="sr-only">
        Your question
      </label>
      <Textarea
        id="question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => onEnter(e, "question")}
        placeholder={disabledReason ?? (checking ? "The question the answer is for…" : "Ask about your documents…")}
        disabled={!!disabledReason}
        rows={2}
        maxLength={MAX_LENGTH}
        aria-describedby="question-hint"
        className="max-h-48 min-h-12 resize-none rounded-none border-0 bg-transparent px-2.5 text-base shadow-none focus-visible:ring-0 disabled:bg-transparent md:text-[16px] dark:bg-transparent dark:disabled:bg-transparent"
      />
      {checking && (
        <div className="mx-2.5 border-t border-rule pt-1">
          <label htmlFor="answer" className="sr-only">
            Answer to check
          </label>
          <Textarea
            id="answer"
            ref={answerField}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => onEnter(e, "answer")}
            placeholder="Paste or write the answer to check. Plant a wrong date or name to see it flagged."
            disabled={!!disabledReason}
            rows={3}
            maxLength={MAX_ANSWER_LENGTH}
            className="max-h-64 min-h-16 resize-none rounded-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 disabled:bg-transparent md:text-[16px] dark:bg-transparent dark:disabled:bg-transparent"
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pt-1 pl-2.5">
        <div className="flex flex-wrap items-center gap-x-4">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <label
                htmlFor="check-mode"
                className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground has-data-checked:text-foreground"
              >
                <Switch
                  id="check-mode"
                  checked={checking}
                  onCheckedChange={(on) => {
                    setChecking(on);
                    if (on) requestAnimationFrame(() => answerField.current?.focus());
                  }}
                />
                <ClipboardCheckIcon className="size-3.5" /> Check an answer
              </label>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Give an answer instead of having the model write one, and see each of its claims checked.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-3">
          {nearLimit && (
            <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {question.length} / {MAX_LENGTH}
            </span>
          )}
          {running ? (
            <Button type="button" variant="outline" className="h-9 border-foreground px-4 font-semibold" onClick={onStop}>
              <SquareIcon className="fill-current" /> Stop
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!canSend}
              className="h-9 gap-2 px-4 font-semibold disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100"
            >
              {checking ? "Check" : "Ask"} <ArrowUpIcon />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
