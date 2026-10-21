# Veritrace frontend

Next.js 16 (App Router), TypeScript, Tailwind CSS 4 and shadcn/ui (Radix). It talks to the FastAPI backend in `../backend`.

```bash
npm install
cp .env.example .env.local   # points at the backend, http://localhost:8000 by default
npm run dev                  # http://localhost:3000
```

The backend must be running, and its `CORS_ORIGINS` must include the frontend's address.

## Layout

| Path | What it is |
|---|---|
| `src/components/veritrace/app-shell.tsx` | Page layout: documents, conversation, inspector |
| `src/components/veritrace/exchange-view.tsx` | One question: agent steps, streaming draft, checked answer |
| `src/components/veritrace/agent-steps.tsx` | Live step indicator, collapsed to a summary when done |
| `src/components/veritrace/answer-card.tsx` | Confidence summary, warnings, safe version, sources, model and search queries |
| `src/components/veritrace/highlighted-answer.tsx` | Sentences coloured by label, clickable |
| `src/components/veritrace/inspector.tsx` | Claim-by-claim signals and the source passage viewer |
| `src/components/veritrace/documents-panel.tsx` | Upload, list and remove documents; load the samples; tick documents to limit questions to them |
| `src/components/veritrace/how-it-works.tsx` | The `/how-it-works` page: steps, signals and weights, models, evaluation results |
| `src/hooks/use-chat.ts` | Streams `/api/chat/stream` and keeps the conversation |
| `src/lib/api.ts`, `src/lib/types.ts` | API client and types mirroring `backend/app/schemas.py` |

`public/samples/` holds copies of the backend's sample documents for the "Add the two sample documents" button.
