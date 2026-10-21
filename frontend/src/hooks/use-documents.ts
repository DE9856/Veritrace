"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { DocumentInfo } from "@/lib/types";

export const ACCEPTED = [".pdf", ".txt", ".md"];

// Shipped in public/samples, so they can be added with one action.
const SAMPLES = ["chandrayaan-3.md", "james-webb-space-telescope.md"];

/** The knowledge base: list, upload and delete documents. */
export function useDocuments(onChange?: () => void) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Documents indexed in the last few seconds; the list highlights them instead of a toast.
  const [fresh, setFresh] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      setDocuments(await api.documents());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api
      .documents()
      .then(
        (list) => active && (setDocuments(list), setError(null)),
        (e) => active && setError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const upload = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        if (!ACCEPTED.includes(ext)) {
          toast.error(`${file.name} was not added`, {
            description: `Veritrace reads ${ACCEPTED.join(", ")} files.`,
          });
          continue;
        }
        setUploading((u) => [...u, file.name]);
        try {
          const doc = await api.upload(file);
          setFresh((f) => [...f, doc.id]);
          setTimeout(() => setFresh((f) => f.filter((id) => id !== doc.id)), 2600);
        } catch (e) {
          toast.error(`${file.name} was not added`, {
            description: e instanceof Error ? e.message : String(e),
          });
        } finally {
          setUploading((u) => u.filter((name) => name !== file.name));
        }
      }
      await refresh();
      onChange?.();
    },
    [refresh, onChange],
  );

  const remove = useCallback(
    async (doc: DocumentInfo) => {
      try {
        await api.remove(doc.id);
        toast.success(`Deleted ${doc.filename}`, {
          description: "The file and its passages are no longer stored.",
        });
      } catch (e) {
        toast.error(`Could not delete ${doc.filename}`, {
          description: e instanceof Error ? e.message : String(e),
        });
      }
      await refresh();
      onChange?.();
    },
    [refresh, onChange],
  );

  const addSamples = useCallback(async () => {
    try {
      const files = await Promise.all(
        SAMPLES.map(async (name) => {
          const response = await fetch(`/samples/${name}`);
          if (!response.ok) throw new Error(response.statusText);
          return new File([await response.blob()], name, { type: "text/markdown" });
        }),
      );
      await upload(files);
    } catch {
      toast.error("Could not load the sample documents.");
    }
  }, [upload]);

  return { documents, loading, uploading, error, fresh, upload, remove, refresh, addSamples };
}
