import { EventStreamContentType, fetchEventSource } from "@microsoft/fetch-event-source";

import type { ChatRequest, ChatResponse, DocumentInfo, Health, StatusEvent } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError(`Cannot reach the Veritrace backend at ${API_URL}. Is it running?`);
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = (await response.json()).detail ?? detail;
    } catch {
      // not JSON; keep the status text
    }
    throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  documents: () => request<DocumentInfo[]>("/api/documents"),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DocumentInfo>("/api/documents", { method: "POST", body: form });
  },
  remove: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),
};

export interface StreamHandlers {
  onStatus: (event: StatusEvent) => void;
  onDraft: (text: string) => void;
  onVerdict: (response: ChatResponse) => void;
  onError: (message: string) => void;
}

class FatalStreamError extends Error {}

/** Ask a question over Server-Sent Events. Resolves when the stream ends. */
export async function streamChat(
  body: ChatRequest,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  try {
    await fetchEventSource(`${API_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
      openWhenHidden: true, // keep streaming when the tab is in the background
      async onopen(response) {
        if (response.ok && response.headers.get("content-type")?.startsWith(EventStreamContentType)) {
          return;
        }
        let detail = `The backend answered ${response.status}.`;
        try {
          detail = (await response.json()).detail ?? detail;
        } catch {
          // keep the generic message
        }
        throw new FatalStreamError(typeof detail === "string" ? detail : JSON.stringify(detail));
      },
      onmessage(message) {
        const data = message.data ? JSON.parse(message.data) : {};
        if (message.event === "status") handlers.onStatus(data as StatusEvent);
        else if (message.event === "draft") handlers.onDraft(data.text as string);
        else if (message.event === "verdict") handlers.onVerdict(data as ChatResponse);
        else if (message.event === "error") handlers.onError(data.message as string);
      },
      onerror(error) {
        // Never retry: a retry would run the whole agent again.
        throw error instanceof FatalStreamError
          ? error
          : new FatalStreamError(`Lost the connection to the backend at ${API_URL}.`);
      },
    });
  } catch (error) {
    if (signal.aborted) return;
    handlers.onError(error instanceof Error ? error.message : String(error));
  }
}
