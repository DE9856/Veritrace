"use client";

import { FileTextIcon, Trash2Icon, UploadIcon } from "lucide-react";
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
        "relative flex min-h-0 shrink flex-col gap-3 rounded-lg transition-colors duration-150",
        dragging && "bg-pencil-soft outline-2 outline-offset-4 outline-pencil/50 outline-dashed",
      )}
    >
      <div className="flex items-baseline justify-between px-2">
        <h2 id="documents-heading" className="text-[13px] font-medium text-muted-foreground">
          Documents
        </h2>
        {documents.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {passages} {passages === 1 ? "passage" : "passages"}
          </span>
        )}
      </div>

      <ul className="-mx-1 min-h-0 space-y-px overflow-y-auto px-1">
        {loading &&
          [0, 1].map((i) => (
            <li key={i} className="flex items-center gap-2.5 px-2 py-2" aria-hidden>
              <Skeleton className="size-4 rounded-[4px]" />
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
                "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-muted",
                ticked && "bg-pencil-soft hover:bg-pencil-soft",
                fresh.includes(doc.id) && "arrive evidence-flash",
              )}
            >
              {documents.length > 1 ? (
                <input
                  type="checkbox"
                  checked={ticked}
                  onChange={() => onToggle(doc.id)}
                  aria-label={`Search only ${doc.filename}`}
                  className="size-4 shrink-0 cursor-pointer accent-pencil"
                />
              ) : (
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug [overflow-wrap:anywhere]" title={doc.filename}>
                  {doc.filename}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                  <FileType filename={doc.filename} />
                  {doc.pages} {doc.pages === 1 ? "page" : "pages"} · {doc.chunks}{" "}
                  {doc.chunks === 1 ? "passage" : "passages"}
                </p>
              </div>
              {confirming === doc.id ? (
                <Button
                  size="xs"
                  variant="destructive"
                  className="arrive"
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
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 pointer-coarse:opacity-100"
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
          <li key={name} className="arrive space-y-1.5 px-2 py-1.5" aria-live="polite">
            <p className="flex items-center gap-1.5 text-sm">
              <FileType filename={name} />
              <span className="min-w-0 truncate text-muted-foreground">Indexing {name}</span>
            </p>
            {/* The backend reports no progress, so this sweeps rather than inventing a percentage. */}
            <div className="indeterminate h-1 rounded-full bg-pencil-soft" />
          </li>
        ))}
        {!loading && documents.length === 0 && uploading.length === 0 && (
          <li className="space-y-3 px-2 py-1 text-sm text-muted-foreground">
            {error ? (
              <p className="text-foreground">{error}</p>
            ) : (
              <p>No documents yet. Answers come only from what you add here.</p>
            )}
          </li>
        )}
      </ul>

      {documents.length > 1 && (
        <p className="px-2 text-xs leading-relaxed text-muted-foreground">
          {selected.length === 0
            ? "Questions search every document. Tick some to search only those."
            : `Questions search only the ${selected.length} ticked. `}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="font-medium text-pencil underline decoration-pencil/30 underline-offset-2 hover:decoration-pencil"
            >
              Search all
            </button>
          )}
        </p>
      )}

      <div className="px-1">
        <Button
          variant="outline"
          className="w-full justify-start"
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
  return (
    <span className="shrink-0 rounded-[3px] bg-pencil-soft px-1 text-[9.5px] leading-[15px] font-semibold tracking-[0.02em] text-pencil">
      {ext}
    </span>
  );
}
