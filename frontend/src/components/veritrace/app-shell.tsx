"use client";

import { ArrowRightIcon, CircleXIcon, UploadIcon, XIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/use-chat";
import { ACCEPTED, useDocuments } from "@/hooks/use-documents";
import { useHealth } from "@/hooks/use-health";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { DocumentInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Composer } from "./composer";
import { DocumentsPanel } from "./documents-panel";
import { ExchangeView } from "./exchange-view";
import { Brand, MobileBar, SidebarFooter } from "./header";
import { ExampleProof } from "./example-proof";
import { Inspector, MarkLegend, type Selection } from "./inspector";

// An alpha mask, not a painted gradient: the thread fades out above the docked composer instead of
// being sliced by its edge.
const FADE_ABOVE_COMPOSER = "[mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]"; // taste-skill-ignore

export function AppShell() {
  const { health, error: healthError, refresh: refreshHealth } = useHealth();
  const docs = useDocuments(refreshHealth);
  const chat = useChat();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  // Matches Tailwind's lg and xl breakpoints: side panels become sheets below them.
  const wide = useMediaQuery("(min-width: 64rem)");
  const extraWide = useMediaQuery("(min-width: 80rem)");
  const thread = useRef<HTMLDivElement>(null);

  // The inspector sheet keeps showing its last selection while it slides away.
  const [held, setHeld] = useState<Selection | null>(selection);
  if (selection && selection !== held) setHeld(selection);
  // Only the sheet needs it: the docked rail must clear the moment it is closed.
  const shown = extraWide ? selection : (selection ?? held);

  const selectedExchange = chat.exchanges.find((e) => e.id === shown?.exchangeId);
  const last = chat.exchanges.at(-1);

  // Follow the newest answer while it streams, unless the reader has scrolled up.
  useEffect(() => {
    const el = thread.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) el.scrollTo({ top: el.scrollHeight });
  }, [last?.draft, last?.steps.length, last?.status, chat.exchanges.length]);

  // Ticked documents that still exist; none ticked means search them all.
  const scoped = docs.documents.filter((d) => ticked.includes(d.id));
  const ask = (question: string, safeMode: boolean, answer?: string) =>
    void chat.ask(
      question,
      safeMode,
      scoped.length > 0 ? { ids: scoped.map((d) => d.id), names: scoped.map((d) => d.filename) } : undefined,
      answer,
    );

  const disabledReason = healthError
    ? "The backend is offline. Start it, then reload."
    : !docs.loading && docs.documents.length === 0
      ? "Add a document first."
      : null;

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col gap-6 px-3 pt-4 pb-3">
      <Brand heading={wide} />
      <DocumentsPanel
        documents={docs.documents}
        loading={docs.loading}
        uploading={docs.uploading}
        fresh={docs.fresh}
        error={docs.error}
        selected={scoped.map((d) => d.id)}
        onToggle={(id) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))}
        onClearSelection={() => setTicked([])}
        onUpload={(files) => void docs.upload(files)}
        onRemove={(doc) => void docs.remove(doc)}
        offline={!!healthError}
      />
      <SidebarFooter health={health} healthError={healthError} />
    </div>
  );
  const inspector = (
    <Inspector
      response={selectedExchange?.response}
      selection={shown}
      onSelect={setSelection}
      onClose={() => setSelection(null)}
    />
  );

  return (
    <div className="flex h-dvh flex-col">
      {!wide && (
        <MobileBar health={health} healthError={healthError} onOpenMenu={() => setDocsOpen(true)} />
      )}

      <div className="relative flex min-h-0 flex-1">
        {wide && <aside className="w-64 shrink-0">{sidebar}</aside>}
        {!wide && (
          <Sheet side="left" open={docsOpen} onClose={() => setDocsOpen(false)} label="Documents and settings">
            {sidebar}
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3.5 right-3"
              onClick={() => setDocsOpen(false)}
              aria-label="Close"
            >
              <XIcon />
            </Button>
          </Sheet>
        )}

        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            wide && "my-2 mr-2 overflow-hidden rounded-lg border bg-canvas",
            extraWide && "mr-0 rounded-r-none border-r-0",
          )}
        >
          <div ref={thread} className={cn("min-h-0 flex-1 overflow-y-auto", FADE_ABOVE_COMPOSER)}>
            <div className="mx-auto w-full max-w-3xl space-y-12 px-4 pt-8 pb-10 sm:px-6 sm:pt-12">
              {chat.exchanges.length === 0 ? (
                <Welcome
                  documents={docs.documents}
                  loading={docs.loading}
                  offline={!!healthError}
                  disabled={!!disabledReason}
                  onAsk={(q) => ask(q, false)}
                  onAddSamples={() => void docs.addSamples()}
                  onUpload={(files) => void docs.upload(files)}
                  adding={docs.uploading.length > 0}
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
          <div className="mx-auto w-full max-w-3xl px-4 pb-3 sm:px-6 sm:pb-4">
            <Composer
              running={chat.running}
              disabledReason={disabledReason}
              onAsk={ask}
              onStop={chat.stop}
            />
            <p id="question-hint" className="mt-2 text-center text-xs text-muted-foreground">
              Every claim in the answer is checked against your documents, so it takes 10 to 30 seconds.
            </p>
          </div>
        </main>

        {extraWide && (
          <aside className="my-2 mr-2 w-[25rem] shrink-0 overflow-hidden rounded-r-lg border">{inspector}</aside>
        )}
        {!extraWide && (
          <Sheet side="right" open={!!selection} onClose={() => setSelection(null)} label="Claim check">
            {inspector}
          </Sheet>
        )}
      </div>
    </div>
  );
}

/** A side sheet below the docking breakpoint. It stays mounted so opening and closing are CSS
 *  transitions, which reverse smoothly if the reader changes their mind mid-way. */
function Sheet({
  side,
  label,
  open,
  onClose,
  children,
}: {
  side: "left" | "right";
  label: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onKey = useEffectEvent((e: KeyboardEvent) => e.key === "Escape" && onClose());

  // Focus moves into the sheet when it opens and back to where it was when it closes.
  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return (
    <div
      data-sheet-open={open}
      inert={!open}
      className={cn(
        "fixed inset-0 z-30 flex overflow-hidden",
        side === "right" && "justify-end",
        !open && "pointer-events-none",
      )}
    >
      <div className="sheet-backdrop absolute inset-0 bg-[rgb(10_11_14/0.32)]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-side={side}
        className={cn(
          "sheet-panel relative h-full w-[min(25rem,90vw)] outline-none",
          side === "left" ? "bg-background" : "bg-sheet",
          open && (side === "left" ? "shadow-[12px_0_32px_rgb(0_0_0/0.16)]" : "shadow-[-12px_0_32px_rgb(0_0_0/0.16)]"),
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
  loading,
  offline,
  disabled,
  adding,
  onAsk,
  onAddSamples,
  onUpload,
}: {
  documents: DocumentInfo[];
  loading: boolean;
  offline: boolean;
  disabled: boolean;
  adding: boolean;
  onAsk: (question: string) => void;
  onAddSamples: () => void;
  onUpload: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const examples = documents.flatMap((d) => {
    const stem = d.filename.replace(/\.[^.]+$/, "");
    return EXAMPLES[stem] ?? [{ question: `What are the main points of ${d.filename}?`, shows: "" }];
  });

  if (offline) {
    return (
      <div className="arrive space-y-4 pt-4 sm:pt-10">
        <CircleXIcon className="size-5" />
        <h2 className="font-serif text-[1.75rem] leading-tight font-semibold tracking-[-0.015em] sm:text-4xl">
          The backend is not running
        </h2>
        <p className="max-w-[60ch] text-muted-foreground">
          Veritrace checks every answer on its own server, on port 8000. Start it with{" "}
          <code className="rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">./start.sh</code>{" "}
          from the project folder, then reload this page.
        </p>
      </div>
    );
  }

  if (!loading && documents.length === 0) {
    return (
      <div className="arrive space-y-8 pt-4 sm:pt-10">
        <div className="space-y-3">
          <h2 className="font-serif text-[2.125rem] leading-[1.05] font-semibold tracking-[-0.022em] sm:text-[3.25rem]">
            Start with a document
          </h2>
          <p className="max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Veritrace answers only from the documents you add, then checks every claim in its answer against them.
            Try it with the two sample documents, on Chandrayaan-3 and the James Webb Space Telescope.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" className="px-4" onClick={onAddSamples} disabled={adding}>
            {adding ? (
              <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-current/30 border-t-current" />
            ) : null}
            {adding ? "Adding the samples…" : "Add the two sample documents"}
          </Button>
          <Button size="lg" variant="outline" className="px-4" onClick={() => input.current?.click()}>
            <UploadIcon /> Upload your own
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              onUpload(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
        <ReadingGuide />
      </div>
    );
  }

  return (
    <div className="arrive space-y-10 pt-4 sm:pt-10">
      <div className="space-y-3">
        <h2 className="font-serif text-[2.125rem] leading-[1.05] font-semibold tracking-[-0.022em] sm:text-[3.25rem]">
          Ask your documents.
        </h2>
        <p className="max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Veritrace answers from the documents you add, then splits its answer into individual claims and tests each
          one against the source passages, against its own repeated answers, and with a second model as judge. Each
          sentence is marked by what it found.
        </p>
      </div>

      {examples.length > 0 && (
        <section aria-labelledby="examples-heading" className="space-y-2">
          <h3 id="examples-heading" className="text-[13px] font-medium text-muted-foreground">
            Questions to try
          </h3>
          <ul className="divide-y divide-rule border-y border-rule">
            {examples.slice(0, 6).map(({ question, shows }) => (
              <li key={question}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onAsk(question)}
                  className="group flex w-full items-baseline gap-3 py-3 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] decoration-foreground/30 underline-offset-4 group-hover:underline">
                      {question}
                    </span>
                    {shows && <span className="mt-0.5 block text-[13px] text-muted-foreground">Shows {shows}</span>}
                  </span>
                  <ArrowRightIcon className="size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-[transform,color] duration-150 ease-(--ease-out) group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReadingGuide />
    </div>
  );
}

function ReadingGuide() {
  return (
    <section aria-labelledby="guide-heading" className="space-y-4 xl:hidden">
      <h3 id="guide-heading" className="font-serif text-xl font-semibold tracking-[-0.01em]">
        How to read a proof
      </h3>
      <ExampleProof className="rounded-lg border bg-sheet p-4 sm:p-5" />
      <MarkLegend className="text-sm sm:grid sm:grid-cols-3 sm:gap-6 sm:space-y-0" />
    </section>
  );
}
