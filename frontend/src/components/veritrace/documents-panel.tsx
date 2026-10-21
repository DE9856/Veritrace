"use client";

import { CheckIcon, FileTextIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCEPTED } from "@/hooks/use-documents";
import type { DocumentInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The knowledge base: drop files anywhere on the panel, see what is indexed, remove documents. */
export function DocumentsPanel({
  documents,
  loading,
  uploading,
  fresh,
  error,
  selected,
  onToggle,
  onClearSelection,
  onUpload,
  onRemove,
  offline,
}: {
  documents: DocumentInfo[];
  loading: boolean;
  uploading: string[];
  fresh: string[]; // just indexed: highlighted for a moment
  error: string | null;
  selected: string[]; // documents the next question is limited to; empty means all
  onToggle: (id: string) => void;
  onClearSelection: () => void;
  onUpload: (files: File[]) => void;
  onRemove: (doc: DocumentInfo) => void;
  offline: boolean; // nothing can be indexed while the backend is down
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const passages = documents.reduce((n, d) => n + d.chunks, 0);

  return (
    <section
      aria-labelledby="documents-heading"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!offline) onUpload(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "relative flex min-h-0 shrink flex-col gap-3 transition-colors duration-150",
        dragging && "bg-signal-soft/50 outline-2 outline-offset-4 outline-signal/70 outline-dashed",
      )}
    >
      <div className="flex items-baseline justify-between border-b border-border px-1 pb-2">
        <h2 id="documents-heading" className="caps text-muted-foreground">
          Documents
        </h2>
        {documents.length > 0 && (
          <span className="figures text-xs text-muted-foreground">
            {passages} {passages === 1 ? "passage" : "passages"}
          </span>
        )}
      </div>

      <ul className="-mx-1 min-h-0 divide-y divide-border/60 overflow-y-auto px-1">
        {loading &&
          [0, 1].map((i) => (
            <li key={i} className="flex items-center gap-2.5 px-1 py-2.5" aria-hidden>
              <Skeleton className="size-4" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </li>
          ))}
        {documents.map((doc) => {
          const ticked = selected.includes(doc.id);
          return (
            <li
              key={doc.id}
              className={cn(
                "group relative flex items-center gap-3 px-1 py-2.5 transition-colors duration-150 hover:bg-muted",
                ticked && "bg-signal-soft hover:bg-signal-soft",
                fresh.includes(doc.id) && "arrive evidence-flash",
              )}
            >
              {documents.length > 1 ? (
                <span className="relative size-4 shrink-0">
                  <input
                    type="checkbox"
                    checked={ticked}
                    onChange={() => onToggle(doc.id)}
                    aria-label={`Search only ${doc.filename}`}
                    className="peer absolute inset-0 cursor-pointer appearance-none border-[1.5px] border-muted-foreground transition-colors duration-150 checked:border-signal checked:bg-signal hover:border-foreground"
                  />
                  <CheckIcon
                    aria-hidden
                    strokeWidth={3}
                    className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
                  />
                </span>
              ) : (
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] leading-snug font-medium" title={doc.filename}>
                  {doc.filename}
                </p>
                <p className="figures mt-0.5 truncate text-xs text-muted-foreground">
                  <FileType filename={doc.filename} /> · {doc.pages} {doc.pages === 1 ? "page" : "pages"} · {doc.chunks}{" "}
                  {doc.chunks === 1 ? "passage" : "passages"}
                </p>
              </div>
              {confirming === doc.id ? (
                <Button
                  size="xs"
                  variant="destructive"
                  className="arrive absolute right-1"
                  onClick={() => {
                    setConfirming(null);
                    onRemove(doc);
                  }}
                  onBlur={() => setConfirming(null)}
                  onKeyDown={(e) => e.key === "Escape" && setConfirming(null)}
                  autoFocus
                >
                  Delete
                </Button>
              ) : (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="absolute right-1 bg-rail text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 pointer-coarse:opacity-100"
                  onClick={() => setConfirming(doc.id)}
                  aria-label={`Delete ${doc.filename}`}
                  title="Delete this document and everything stored for it"
                >
                  <Trash2Icon />
                </Button>
              )}
            </li>
          );
        })}
        {uploading.map((name) => (
          <li key={name} className="arrive space-y-2 px-1 py-2.5" aria-live="polite">
            <p className="flex items-center gap-1.5 text-[13px]">
              <FileType filename={name} />
              <span className="min-w-0 truncate text-muted-foreground">Indexing {name}</span>
            </p>
            {/* The backend reports no progress, so this sweeps rather than inventing a percentage. */}
            <div className="indeterminate h-1 bg-signal-soft text-signal" />
          </li>
        ))}
        {!loading && documents.length === 0 && uploading.length === 0 && (
          <li className="space-y-3 px-1 py-2 text-sm text-muted-foreground">
            {error ? (
              <p className="text-foreground">{error}</p>
            ) : (
              <p>No documents yet. Answers come only from what you add here.</p>
            )}
          </li>
        )}
      </ul>

      {documents.length > 1 && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          {selected.length === 0
            ? "Questions search every document. Tick some to search only those."
            : `Questions search only the ${selected.length} ticked. `}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="font-semibold text-signal underline decoration-signal/40 underline-offset-2 hover:decoration-signal"
            >
              Search all
            </button>
          )}
        </p>
      )}

      <div>
        <Button
          variant="outline"
          className="h-9 w-full justify-start border-foreground/70 font-semibold"
          disabled={offline}
          onClick={() => input.current?.click()}
        >
          <UploadIcon /> Add documents
        </Button>
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          {offline
            ? "Documents can be added once the backend is running."
            : `${ACCEPTED.join(", ")} files. Or drop them on this panel.`}
        </p>
      </div>
      <input
        ref={input}
        id="document-upload"
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          onUpload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </section>
  );
}

/** The file's kind, as a small label: PDF, MD or TXT. */
function FileType({ filename }: { filename: string }) {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toUpperCase();
  return <span className="shrink-0 font-bold tracking-[0.04em] text-foreground/80">{ext}</span>;
}
