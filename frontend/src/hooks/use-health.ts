"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Health } from "@/lib/types";

const POLL_MS = 30_000;

/** Backend and model status, polled while the page is open. */
export function useHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setHealth(await api.health());
      setError(null);
    } catch (e) {
      setHealth(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    let active = true;
    const poll = () =>
      api.health().then(
        (h) => {
          if (!active) return;
          setHealth(h);
          setError(null);
        },
        (e) => {
          if (!active) return;
          setHealth(null);
          setError(e instanceof Error ? e.message : String(e));
        },
      );
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return { health, error, refresh };
}
