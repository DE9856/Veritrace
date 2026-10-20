"use client";

import { FileTextIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ACCEPTED } from "@/hooks/use-documents";
import type { DocumentInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

const SAMPLES = ["chandrayaan-3.md", "james-webb-space-telescope.md"];

/** The knowledge base: drop files in, see what is indexed, remove documents. */
export function DocumentsPanel({
  documents,
  loading,
  uploading,
  error,
  onUpload,
  onRemove,
}: {
  documents: DocumentInfo[];
  loading: boolean;
  uploading: string[];
  error: string | null;
  onUpload: (files: File[]) => void;
  onRemove: (doc: DocumentInfo) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const addSamples = async () => {
    try {
      const files = await Promise.all(
        SAMPLES.map(async (name) => {
          const response = await fetch(`/samples/${name}`);
          return new File([await response.blob()], name, { type: "text/markdown" });
        }),
      );
      onUpload(files);
    } catch {
      toast.error("Could not load the sample documents.");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-medium">Documents</h2>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {documents.reduce((n, d) => n + d.chunks, 0)} passages
        </span>
      </div>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onUpload(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center text-sm transition-colors",
          "hover:border-primary hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          dragging && "border-primary bg-accent",
        )}
      >
        <UploadIcon className="size-4 text-primary" />
        <span className="font-medium">Add documents</span>
        <span className="text-xs text-muted-foreground">Drop or choose {ACCEPTED.join(", ")} files</span>
      </button>
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

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {uploading.map((name) => (
          <li key={name} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 shrink-0 animate-spin" />
            <span className="truncate">Indexing {name}</span>
          </li>
        ))}
        {documents.map((doc) => (
          <li key={doc.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm" title={doc.filename}>
                {doc.filename}
              </p>
              <p className="text-xs text-muted-foreground">
                {doc.pages} {doc.pages === 1 ? "page" : "pages"} · {doc.chunks} passages
              </p>
            </div>
            {confirming === doc.id ? (
              <Button
                size="xs"
                variant="destructive"
                onClick={() => {
                  setConfirming(null);
                  onRemove(doc);
                }}
                onBlur={() => setConfirming(null)}
                autoFocus
              >
                Remove
              </Button>
            ) : (
              <Button
                size="icon-xs"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => setConfirming(doc.id)}
                aria-label={`Remove ${doc.filename}`}
              >
                <Trash2Icon />
              </Button>
            )}
          </li>
        ))}
        {!loading && documents.length === 0 && uploading.length === 0 && (
          <li className="space-y-2 px-2 py-3 text-sm text-muted-foreground">
            {error ? (
              <p>{error}</p>
            ) : (
              <>
                <p>No documents yet. Answers come only from what you add here.</p>
                <Button size="sm" variant="outline" onClick={addSamples}>
                  Add the two sample documents
                </Button>
              </>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}
