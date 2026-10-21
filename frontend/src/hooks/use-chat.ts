"use client";

import { useCallback, useRef, useState } from "react";

import { streamChat } from "@/lib/api";
import type { ChatResponse } from "@/lib/types";

export interface Step {
  node: string;
  message: string;
}

export type ExchangeStatus = "running" | "done" | "error" | "stopped";

export interface Exchange {
  id: string;
  question: string;
  safeMode: boolean;
  documents?: string[]; // filenames the question was limited to; undefined means all
  steps: Step[];
  draft: string;
  response?: ChatResponse;
  error?: string;
  status: ExchangeStatus;
  startedAt: number;
  finishedAt?: number;
}

/** One question at a time, streamed from the agent. Exchanges stay in memory only. */
export function useChat() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const controller = useRef<AbortController | null>(null);

  const update = useCallback((id: string, change: (e: Exchange) => Partial<Exchange>) => {
    setExchanges((all) => all.map((e) => (e.id === id ? { ...e, ...change(e) } : e)));
  }, []);

  const ask = useCallback(
    async (question: string, safeMode: boolean, scope?: { ids: string[]; names: string[] }) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      const id = crypto.randomUUID();
      setExchanges((all) => [
        ...all,
        {
          id,
          question,
          safeMode,
          documents: scope?.names,
          steps: [],
          draft: "",
          status: "running",
          startedAt: Date.now(),
        },
      ]);

      let finished = false;
      await streamChat(
        { question, safe_mode: safeMode, document_ids: scope?.ids },
        {
          onStatus: (step) => update(id, (e) => ({ steps: [...e.steps, step] })),
          onDraft: (text) => update(id, () => ({ draft: text })),
          onVerdict: (response) => {
            finished = true;
            update(id, () => ({ response, status: "done", finishedAt: Date.now() }));
          },
          onError: (message) => {
            finished = true;
            update(id, () => ({ error: message, status: "error", finishedAt: Date.now() }));
          },
        },
        abort.signal,
      );
      if (!finished) {
        update(id, () => ({
          status: abort.signal.aborted ? "stopped" : "error",
          error: abort.signal.aborted ? undefined : "The stream ended without an answer.",
          finishedAt: Date.now(),
        }));
      }
      if (controller.current === abort) controller.current = null;
    },
    [update],
  );

  const stop = useCallback(() => controller.current?.abort(), []);
  const clear = useCallback(() => {
    controller.current?.abort();
    setExchanges([]);
  }, []);

  const running = exchanges.some((e) => e.status === "running");
  return { exchanges, ask, stop, clear, running };
}
