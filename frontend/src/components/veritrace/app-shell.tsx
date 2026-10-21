"use client";

import { ArrowRightIcon, CircleXIcon, UploadIcon, XIcon } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/use-chat";
import { ACCEPTED, useDocuments } from "@/hooks/use-documents";
import { useHealth } from "@/hooks/use-health";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { DocumentInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Composer } from "./composer";
import { DocumentsPanel } from "./documents-panel";
import { ExampleProof } from "./example-proof";
import { ExchangeView } from "./exchange-view";
import { Brand, SidebarFooter, TopBar } from "./header";
import { Inspector, MarkLegend, PANEL_ID, type Selection } from "./inspector";

// An alpha mask, not a painted gradient: the thread fades out above the docked composer instead of
// being sliced by its edge.
const FADE_ABOVE_COMPOSER =
  "[mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]"; // taste-skill-ignore
const PANEL_KEY = "veritrace.claim-panel";

export function AppShell() {
  const { health, error: healthError, refresh: refreshHealth } = useHealth();
  const docs = useDocuments(refreshHealth);
  const chat = useChat();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  // Matches Tailwind's lg and xl breakpoints: the rail becomes a sheet below lg, and the claim
  // panel docks beside the thread from xl and slides over it below.
  const wide = useMediaQuery("(min-width: 64rem)");
  const extraWide = useMediaQuery("(min-width: 80rem)");
  const thread = useRef<HTMLDivElement>(null);

  // The claim panel stays closed until a claim is picked. Opening or closing it with the toggle is
  // remembered for the docked panel; the sliding sheet only opens on demand, so it never covers the
  // thread on load.
  const [dockPref, setDockPref] = useStoredFlag(PANEL_KEY);
  const [sheetPinned, setSheetPinned] = useState(false);
  const panelOpen = selection !== null || (extraWide ? dockPref : sheetPinned);
  const closePanel = () => {
    setSelection(null);
    if (extraWide) setDockPref(false);
    else setSheetPinned(false);
  };
  const togglePanel = () => {
    if (panelOpen) closePanel();
    else if (extraWide) setDockPref(true);
    else setSheetPinned(true);
  };

  // The sheet keeps showing its last selection while it slides away.
  const [held, setHeld] = useState<Selection | null>(selection);
  if (selection && selection !== held) setHeld(selection);
  const shown = extraWide
    ? selection
    : (selection ?? (panelOpen ? null : held));

  const selectedExchange = chat.exchanges.find(
    (e) => e.id === shown?.exchangeId,
  );
  const last = chat.exchanges.at(-1);
  const lastId = last?.id;
  const lastStatus = last?.status;

  // Follow the newest answer while it streams, unless the reader has scrolled up.
  useEffect(() => {
    const el = thread.current;
    if (!el || chat.exchanges.length === 0) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240)
      el.scrollTo({ top: el.scrollHeight });
  }, [last?.draft, last?.steps.length, last?.status, chat.exchanges.length]);

  // When a verdict lands, bring its question back to the top: the confidence and the checked
  // answer start there, and following the stream left the reader at the foot of the claims.
  useEffect(() => {
    const el = thread.current;
    const sheet = lastId && document.getElementById(`exchange-${lastId}`);
    if (lastStatus !== "done" || !el || !sheet) return;
    // Scroll the thread alone; scrollIntoView would also scroll the page and hide the top bar.
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const top =
      sheet.getBoundingClientRect().top -
      el.getBoundingClientRect().top +
      el.scrollTop -
      16;
    el.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }, [lastId, lastStatus]);

  // When the claim panel opens and the thread re-flows narrower, keep the picked sentence and its
  // question in view: the question at the top if the sheet's head down to the sentence fits,
  // otherwise the sentence in the middle.
  const selectedKey =
    selection?.kind === "sentence"
      ? `${selection.exchangeId}:${selection.index}`
      : null;
  useEffect(() => {
    if (!selectedKey) return;
    const timer = setTimeout(() => {
      const el = thread.current;
      const sentence = el?.querySelector<HTMLElement>(
        '.sentence[aria-pressed="true"]',
      );
      const sheet = sentence?.closest("section");
      if (!el || !sentence || !sheet) return;
      const box = el.getBoundingClientRect();
      const head =
        sheet.getBoundingClientRect().top - box.top + el.scrollTop - 16;
      const foot =
        sentence.getBoundingClientRect().bottom - box.top + el.scrollTop;
      if (head >= el.scrollTop - 1 && foot <= el.scrollTop + el.clientHeight)
        return; // already in view
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const top =
        foot - head < el.clientHeight - 48 ? head : foot - el.clientHeight / 2;
      if (Math.abs(top - el.scrollTop) > 4)
        el.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    }, 340); // after the docked panel's width transition
    return () => clearTimeout(timer);
  }, [selectedKey]);

  // Ticked documents that still exist; none ticked means search them all.
  const scoped = docs.documents.filter((d) => ticked.includes(d.id));
  const ask = (question: string, safeMode: boolean, answer?: string) =>
    void chat.ask(
      question,
      safeMode,
      scoped.length > 0
        ? { ids: scoped.map((d) => d.id), names: scoped.map((d) => d.filename) }
        : undefined,
      answer,
    );

  const disabledReason = healthError
    ? "The backend is offline. Start it, then reload."
    : !docs.loading && docs.documents.length === 0
      ? "Add a document first."
      : null;
  const count = docs.documents.length;
  const scope = healthError
    ? "Backend offline"
    : docs.loading
      ? null
      : count === 0
        ? "No documents yet"
        : scoped.length > 0
          ? `Searching ${scoped.length} of ${count} documents`
          : `Searching all ${count} ${count === 1 ? "document" : "documents"}`;

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col gap-8 px-5 pt-7 pb-4">
      <Brand heading={wide} />
      <DocumentsPanel
        documents={docs.documents}
        loading={docs.loading}
        uploading={docs.uploading}
        fresh={docs.fresh}
        error={docs.error}
        selected={scoped.map((d) => d.id)}
        onToggle={(id) =>
          setTicked((t) =>
            t.includes(id) ? t.filter((x) => x !== id) : [...t, id],
          )
        }
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
      onClose={closePanel}
    />
  );

  return (
    <div className="flex h-dvh">
      {wide && (
        <aside className="dark rail-scope w-64 shrink-0 bg-rail text-foreground">
          {sidebar}
        </aside>
      )}
      {!wide && (
        <Sheet
          side="left"
          open={docsOpen}
          onClose={() => setDocsOpen(false)}
          label="Documents and settings"
        >
          <div className="dark rail-scope relative h-full bg-rail text-foreground">
            {sidebar}
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-6 right-3"
              onClick={() => setDocsOpen(false)}
              aria-label="Close"
            >
              <XIcon />
            </Button>
          </div>
        </Sheet>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          compact={!wide}
          health={health}
          healthError={healthError}
          scope={scope}
          panelOpen={panelOpen}
          onTogglePanel={togglePanel}
          onOpenMenu={() => setDocsOpen(true)}
        />
        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col bg-canvas">
            <div
              ref={thread}
              className={cn(
                "@container/thread min-h-0 flex-1 overflow-y-auto",
                FADE_ABOVE_COMPOSER,
              )}
            >
              <div className="relative min-h-full">
                <div className="relative mx-auto min-h-full w-full max-w-[80rem] space-y-8 px-3 pt-4 pb-12 sm:px-6 sm:pt-8 lg:px-8">
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
                    chat.exchanges.map((exchange, i) => (
                      <ExchangeView
                        key={exchange.id}
                        exchange={exchange}
                        number={i + 1}
                        selection={selection}
                        onSelect={setSelection}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="@container/foot mx-auto w-full max-w-[80rem] px-3 pb-3 sm:px-6 sm:pb-4 lg:px-8">
              {/* The composer keeps one size: the full measure of the page, inset like a sheet's content. */}
              <div className="px-[calc(1.25rem+1px)] sm:px-[calc(2rem+1px)]">
                <div>
                  <Composer
                    running={chat.running}
                    disabledReason={disabledReason}
                    onAsk={ask}
                    onStop={chat.stop}
                  />
                  <p
                    id="question-hint"
                    className="mt-2 text-xs text-muted-foreground"
                  >
                    Every claim in the answer is checked against your documents,
                    so an answer takes 10 to 30 seconds.
                  </p>
                </div>
              </div>
            </div>
          </main>

          {extraWide && (
            <aside
              id={PANEL_ID}
              aria-label="Claim check"
              data-open={panelOpen}
              inert={!panelOpen}
              className={cn(
                "panel-dock shrink-0 overflow-hidden border-l-2 border-foreground",
                panelOpen ? "w-[26rem]" : "w-0 border-l-0",
              )}
            >
              <div className="h-full w-[26rem]">{inspector}</div>
            </aside>
          )}
        </div>
      </div>

      {!extraWide && (
        <Sheet
          side="right"
          open={panelOpen}
          onClose={closePanel}
          label="Claim check"
          id={PANEL_ID}
        >
          {inspector}
        </Sheet>
      )}
    </div>
  );
}

/** A boolean kept in localStorage, read after hydration so the server and first client render
 *  agree. Storage can be unavailable (private windows, blocked site data), so every access is
 *  guarded and the flag simply falls back to off. */
function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const stored = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener(`${key}:change`, notify);
      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener(`${key}:change`, notify);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(key) === "open";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = (value: boolean) => {
    try {
      window.localStorage.setItem(key, value ? "open" : "closed");
    } catch {
      // Storage is unavailable; the panel still opens and closes, it just is not remembered.
    }
    window.dispatchEvent(new Event(`${key}:change`));
  };
  return [stored, set];
}

/** A side sheet below the docking breakpoint. It stays mounted so opening and closing are CSS
 *  transitions, which reverse smoothly if the reader changes their mind mid-way. */
function Sheet({
  side,
  label,
  open,
  onClose,
  id,
  children,
}: {
  side: "left" | "right";
  label: string;
  open: boolean;
  onClose: () => void;
  id?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onKey = useEffectEvent(
    (e: KeyboardEvent) => e.key === "Escape" && onClose(),
  );

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
      <div
        className="sheet-backdrop absolute inset-0 bg-[rgb(10_11_14/0.4)]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-side={side}
        className={cn(
          "sheet-panel relative h-full w-[min(26rem,92vw)] outline-none",
          side === "right" && "border-l-2 border-foreground bg-sheet",
          open &&
            (side === "left"
              ? "shadow-[12px_0_32px_rgb(0_0_0/0.2)]"
              : "shadow-[-12px_0_32px_rgb(0_0_0/0.16)]"),
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
    {
      question: "When did Vikram land and what did the rover find?",
      shows: "Every claim stated",
    },
    {
      question: "Why did the Chandrayaan-3 surface mission end?",
      shows: "Stated and inferred claims",
    },
  ],
  "james-webb-space-telescope": [
    {
      question:
        "Who was James E. Webb and why was the telescope named after him?",
      shows: "Often an unsupported claim; try safe mode",
    },
    {
      question:
        "Why does MIRI need a cryocooler, and why is the mirror coated in gold?",
      shows: "Stated and inferred claims",
    },
    {
      question: "Why was JWST launched on a Falcon 9 rocket?",
      shows: "A false premise",
    },
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
    return (
      EXAMPLES[stem] ?? [
        { question: `What are the main points of ${d.filename}?`, shows: "" },
      ]
    );
  });

  if (offline) {
    return (
      <div className="arrive space-y-5 px-[calc(1.25rem+1px)] pt-8 pb-10 sm:px-[calc(2rem+1px)] sm:pt-12">
        <CircleXIcon className="size-6" />
        <h2 className="text-[2.5rem] leading-[0.95] font-extrabold tracking-[-0.015em] [word-spacing:0.08em] font-stretch-70% sm:text-[3.5rem]">
          The backend is not running
        </h2>
        <p className="max-w-[60ch] text-[17px] leading-relaxed text-muted-foreground">
          Veritrace checks every answer on its own server, on port 8000. Start
          it with{" "}
          <code className="bg-muted px-1.5 py-0.5 font-mono text-[14px] text-foreground">
            ./start.sh
          </code>{" "}
          from the project folder, then reload this page.
        </p>
      </div>
    );
  }

  const intro = (
    <h2 className="text-[3.25rem] leading-[0.88] font-extrabold tracking-[-0.015em] [word-spacing:0.1em] font-stretch-62% sm:text-[4.5rem] @5xl/thread:text-[6rem]">
      {documents.length === 0 && !loading
        ? "Start with a document."
        : "Ask your documents."}
    </h2>
  );

  return (
    <div className="arrive grid grid-cols-1 gap-x-6 gap-y-12 px-[calc(1.25rem+1px)] pt-8 pb-10 sm:px-[calc(2rem+1px)] sm:pt-12 @4xl/thread:grid-cols-12">
      <div className="border-b-2 border-foreground pb-8 sm:pb-10 @4xl/thread:col-span-12">
        {intro}
      </div>

      <div className="space-y-10 @4xl/thread:col-span-7">
        {!loading && documents.length === 0 ? (
          <>
            <p className="max-w-[56ch] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">
              Veritrace answers only from the documents you add, then checks
              every claim in its answer against them. Try it with the two sample
              documents, on Chandrayaan-3 and the James Webb Space Telescope.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                className="h-11 px-5 font-semibold"
                onClick={onAddSamples}
                disabled={adding}
              >
                {adding ? (
                  <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-current/30 border-t-current" />
                ) : null}
                {adding
                  ? "Adding the samples…"
                  : "Add the two sample documents"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 border-foreground px-5 font-semibold"
                onClick={() => input.current?.click()}
              >
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
          </>
        ) : (
          <p className="max-w-[56ch] text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">
            Veritrace answers from the documents you add, then splits its answer
            into individual claims and tests each one against the source
            passages, against its own repeated answers, and with a second model
            as judge. Each claim is scored and labelled by what it found.
          </p>
        )}

        {examples.length > 0 && (
          <section aria-labelledby="examples-heading">
            <h3
              id="examples-heading"
              className="caps border-b-2 border-foreground pb-2"
            >
              Questions to try
            </h3>
            <ul className="divide-y divide-rule border-b border-rule">
              {examples.slice(0, 6).map(({ question, shows }) => (
                <li key={question}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onAsk(question)}
                    className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-3.5 text-left transition-colors duration-150 hover:bg-signal/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0 pl-1">
                      <span className="block text-[16px] font-medium">
                        {question}
                      </span>
                      {shows && (
                        <span className="mt-0.5 block text-[13px] text-muted-foreground">
                          {shows}
                        </span>
                      )}
                    </span>
                    <ArrowRightIcon className="mr-1 size-4 translate-y-0.5 text-muted-foreground transition-[transform,color] duration-150 ease-(--ease-out) group-hover:translate-x-0.5 group-hover:text-signal" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section
        aria-labelledby="guide-heading"
        className="space-y-5 border-t border-border pt-10 @4xl/thread:col-span-5 @4xl/thread:col-start-8 @4xl/thread:-ml-3 @4xl/thread:border-t-0 @4xl/thread:border-l @4xl/thread:pt-0 @4xl/thread:pl-9"
      >
        <h3
          id="guide-heading"
          className="caps border-b-2 border-foreground pb-2"
        >
          How to read an answer
        </h3>
        <ExampleProof />
        <MarkLegend className="text-sm" />
      </section>
    </div>
  );
}
