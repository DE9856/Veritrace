"use client";

import { useEffect, useRef, useState } from "react";

import { useChat } from "@/hooks/use-chat";
import { useDocuments } from "@/hooks/use-documents";
import { useHealth } from "@/hooks/use-health";
import { useMediaQuery } from "@/hooks/use-media-query";
import { LABEL_BAR, LABEL_HINT, LABEL_TEXT } from "@/lib/labels";
import type { DocumentInfo, Label } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Composer } from "./composer";
import { DocumentsPanel } from "./documents-panel";
import { ExchangeView } from "./exchange-view";
import { Header } from "./header";
import { Inspector, type Selection } from "./inspector";

export function AppShell() {
  const { health, error: healthError, refresh: refreshHealth } = useHealth();
  const docs = useDocuments(refreshHealth);
  const chat = useChat();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  // Matches Tailwind's lg and xl breakpoints: side panels become overlays below them.
  const wide = useMediaQuery("(min-width: 64rem)");
  const extraWide = useMediaQuery("(min-width: 80rem)");
  const thread = useRef<HTMLDivElement>(null);

  const selectedExchange = chat.exchanges.find((e) => e.id === selection?.exchangeId);
  const last = chat.exchanges.at(-1);

  // Follow the newest answer while it streams, unless the reader has scrolled up.
  useEffect(() => {
    const el = thread.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) el.scrollTo({ top: el.scrollHeight });
  }, [last?.draft, last?.steps.length, last?.status, chat.exchanges.length]);

  // Ticked documents that still exist; none ticked means search them all.
  const scoped = docs.documents.filter((d) => ticked.includes(d.id));
  const ask = (question: string, safeMode: boolean) =>
    void chat.ask(
      question,
      safeMode,
      scoped.length > 0 ? { ids: scoped.map((d) => d.id), names: scoped.map((d) => d.filename) } : undefined,
    );

  const disabledReason = healthError
    ? "The backend is offline. Start it, then reload."
    : !docs.loading && docs.documents.length === 0
      ? "Add a document first."
      : null;

  const documentsPanel = (
    <DocumentsPanel
      documents={docs.documents}
      loading={docs.loading}
      uploading={docs.uploading}
      error={docs.error}
      selected={scoped.map((d) => d.id)}
      onToggle={(id) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))}
      onClearSelection={() => setTicked([])}
      onUpload={(files) => void docs.upload(files)}
      onRemove={(doc) => void docs.remove(doc)}
    />
  );
  const inspector = (
    <Inspector
      response={selectedExchange?.response}
      selection={selection}
      onSelect={setSelection}
      onClose={() => setSelection(null)}
    />
  );

  return (
    <div className="flex h-dvh flex-col">
      <Header health={health} healthError={healthError} onToggleDocuments={() => setDocsOpen((o) => !o)} />

      <div className="relative flex min-h-0 flex-1">
        {wide && <aside className="w-72 shrink-0 border-r bg-surface">{documentsPanel}</aside>}
        {!wide && docsOpen && (
          <Overlay side="left" onClose={() => setDocsOpen(false)} label="Documents">
            {documentsPanel}
          </Overlay>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div ref={thread} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6">
              {chat.exchanges.length === 0 ? (
                <Welcome
                  documents={docs.documents}
                  disabled={!!disabledReason}
                  onAsk={(q) => ask(q, false)}
                />
              ) : (
                chat.exchanges.map((exchange) => (
                  <ExchangeView
                    key={exchange.id}
                    exchange={exchange}
                    selection={selection}
                    onSelect={setSelection}
                  />
                ))
              )}
            </div>
          </div>
          <div className="mx-auto w-full max-w-3xl px-4 pb-4">
            <Composer
              running={chat.running}
              disabledReason={disabledReason}
              onAsk={ask}
              onStop={chat.stop}
            />
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Each answer is written first, then every claim in it is checked, so it takes 10 to 30 seconds.
            </p>
          </div>
        </main>

        {extraWide && <aside className="w-[25rem] shrink-0 border-l bg-surface">{inspector}</aside>}
        {!extraWide && selection && (
          <Overlay side="right" onClose={() => setSelection(null)} label="Inspector">
            {inspector}
          </Overlay>
        )}
      </div>
    </div>
  );
}

function Overlay({
  side,
  label,
  onClose,
  children,
}: {
  side: "left" | "right";
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={cn("absolute inset-0 z-20 flex", side === "right" && "justify-end")}>
      <button type="button" aria-label={`Close ${label}`} className="absolute inset-0 bg-foreground/20" onClick={onClose} />
      <div
        role="dialog"
        aria-label={label}
        className={cn(
          "relative h-full w-[min(25rem,100%)] bg-surface shadow-xl",
          side === "left" ? "border-r" : "border-l",
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Questions for the sample documents, each showing a different part of the checking.
const EXAMPLES: Record<string, { question: string; shows: string }[]> = {
  "chandrayaan-3": [
    { question: "When did Vikram land and what did the rover find?", shows: "every claim stated" },
    { question: "Why did the Chandrayaan-3 surface mission end?", shows: "stated and inferred claims" },
  ],
  "james-webb-space-telescope": [
    {
      question: "Who was James E. Webb and why was the telescope named after him?",
      shows: "often an unsupported claim; try safe mode",
    },
    {
      question: "Why does MIRI need a cryocooler, and why is the mirror coated in gold?",
      shows: "stated and inferred claims",
    },
    { question: "Why was JWST launched on a Falcon 9 rocket?", shows: "a false premise" },
  ],
};

function Welcome({
  documents,
  disabled,
  onAsk,
}: {
  documents: DocumentInfo[];
  disabled: boolean;
  onAsk: (question: string) => void;
}) {
  const examples = documents.flatMap((d) => {
    const stem = d.filename.replace(/\.[^.]+$/, "");
    return EXAMPLES[stem] ?? [{ question: `What are the main points of ${d.filename}?`, shows: "" }];
  });

  return (
    <div className="space-y-8 pt-6 sm:pt-12">
      <div className="space-y-3">
        <h2 className="text-3xl leading-tight font-semibold sm:text-4xl">
          Ask your documents.
          <br />
          <span className="text-muted-foreground">Every claim gets checked.</span>
        </h2>
        <p className="max-w-[60ch] text-muted-foreground">
          Veritrace answers from the documents you add, then splits its answer into individual claims and tests
          each one against the source passages, against its own repeated answers, and with a second model as
          judge. Each sentence is highlighted by what it found.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {(["high", "inferred", "hallucinated"] as Label[]).map((label) => (
          <li key={label} className="rounded-lg border bg-card p-3">
            <div className={cn("mb-2 h-1 w-8 rounded-full", LABEL_BAR[label])} />
            <p className="text-sm font-medium">{LABEL_TEXT[label]}</p>
            <p className="text-sm text-muted-foreground">{LABEL_HINT[label]}</p>
          </li>
        ))}
      </ul>

      {examples.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Try asking</p>
          <div className="flex flex-col items-start gap-2">
            {examples.slice(0, 6).map(({ question, shows }) => (
              <button
                key={question}
                type="button"
                disabled={disabled}
                onClick={() => onAsk(question)}
                className="rounded-lg border bg-card px-3 py-1.5 text-left text-sm hover:border-primary hover:bg-accent disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {question}
                {shows && <span className="ml-2 text-xs text-muted-foreground">{shows}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
