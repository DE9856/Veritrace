"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { DocumentInfo } from "@/lib/types";

export const ACCEPTED = [".pdf", ".txt", ".md"];

/** The knowledge base: list, upload and delete documents. */
export function useDocuments(onChange?: () => void) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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
          toast.success(`Added ${doc.filename}`, {
            description: `${doc.pages} ${doc.pages === 1 ? "page" : "pages"}, ${doc.chunks} passages indexed.`,
          });
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

  return { documents, loading, uploading, error, upload, remove, refresh };
}
