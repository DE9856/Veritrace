# Starting Veritrace

Everything you need to turn Veritrace on, from a fresh clone to a running app. Run every command from the repository root unless a step says otherwise.

| | What runs | Where |
|---|---|---|
| Backend | FastAPI agent, embeddings, NLI checker | http://localhost:8000 (API docs at `/docs`) |
| Frontend | Next.js web app | http://localhost:3000 |
| LLM | Groq `openai/gpt-oss-120b`, with Gemini `gemini-3.5-flash` as fallback, or Ollama `qwen3:4b-instruct` offline | hosted, or on this laptop |

## 1. One-time setup

You need Python 3.12 through [uv](https://docs.astral.sh/uv/), Node.js 20 or newer, and [Ollama](https://ollama.com) for the offline mode.

**Backend**

```bash
cd backend
uv venv --python 3.12
uv pip install torch --index-url https://download.pytorch.org/whl/cpu
uv pip install -r requirements-dev.txt
cp .env.example .env
cd ..
```

Then open `backend/.env` in an editor and set:

```bash
LLM_PROVIDER=groq
LLM_FALLBACK=gemini
GROQ_API_KEY=...        # https://console.groq.com/keys
GEMINI_API_KEY=...      # https://aistudio.google.com/apikey
CONSISTENCY_SAMPLES=2   # fewer tokens per question on the free tiers
SEED_SAMPLES=true       # index the two sample documents when the store is empty
```

Keep the keys in `backend/.env` only. It is gitignored; never paste keys into chat, commits or screenshots.

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
cd ..
```

**Offline model** (only for `./start.sh ollama`, about 2.5 GB)

```bash
ollama pull qwen3:4b-instruct
```

**First start downloads the checker models** (bge-small, about 130 MB, and DeBERTa NLI, about 700 MB) into the Hugging Face cache. Do the first start on a good connection, not on the day.

## 2. Every time

```bash
./start.sh            # Groq, with Gemini as fallback (the normal mode)
./start.sh ollama     # fully offline on the local model; starts Ollama if needed
./start.sh gemini     # Gemini first, Groq as fallback
```

Wait for these lines (the first start takes about 20 seconds while the models load):

```
Backend ok: groq / openai/gpt-oss-120b, 2 documents
Veritrace is running: open http://localhost:3000  (Ctrl+C to stop)
```

Then open http://localhost:3000. The dot in the header should be green and name the model. If the documents panel is empty, choose **Add the two sample documents**.

**To stop:** press Ctrl+C in the terminal running `start.sh`. It stops the backend, the frontend and, if it started it, Ollama.

## 3. Manual start (if `start.sh` fails)

Two terminals:

```bash
# Terminal 1: backend
cd backend
.venv/bin/uvicorn app.main:app --port 8000
# offline instead: LLM_PROVIDER=ollama LLM_FALLBACK= .venv/bin/uvicorn app.main:app --port 8000
# (and run `ollama serve` in a third terminal if Ollama is not already running)
```

```bash
# Terminal 2: frontend
cd frontend
npm run dev -- --port 3000
```

Stop each with Ctrl+C.

## 4. Check that it works

```bash
curl -s localhost:8000/api/health                        # status "ok", the model, document count
cd backend && .venv/bin/pytest -q && cd ..               # all tests pass (no models or keys needed)
cd frontend && npx tsc --noEmit && npm run lint && cd ..  # types and lint
```

## 5. Limits worth knowing

- **Groq free tier:** 8,000 tokens a minute and 200,000 tokens per rolling 24 hours. A question on the sample documents uses several thousand tokens; on a long document, whose passages are full-length, several times more. If the per-minute limit is hit, the app waits (up to 30 seconds) and continues. If the daily cap is hit, Gemini takes over at once, and Groq is skipped until the reset time it gives. Tokens come back 24 hours after they were spent, so the quota recovers gradually.
- **Calibration runs on Groq** (`calibration/run_groq.sh`) use the same daily quota as the app; a few dozen claims can use it up. Run them on Ollama, or not on the day of a demo.
- **Gemini free tier:** 20 requests a day, about three questions.
- **Ollama:** no limits. The first question takes about a minute while the model loads; later ones take 10 to 20 seconds. Use it for rehearsing so the Groq quota is left for the presentation.

## 6. Common problems

| Problem | Fix |
|---|---|
| `backend/.venv is missing` | Do the backend part of step 1. |
| `backend/.env is missing` | `cp backend/.env.example backend/.env` and add the keys. |
| `port 8000 is already in use` (or 3000) | An earlier run is still going. Close its terminal, or `pkill -f "uvicorn app.main"` / `pkill -f "next dev"`. |
| `run 'ollama pull qwen3:4b-instruct' first` | Run it once (step 1). |
| Header dot is amber | The model is not reachable. Hover over the dot for the reason: a wrong key, no internet or a rate limit. Without internet, restart with `./start.sh ollama`. |
| Header dot is red | The backend is not running. Check the terminal for an error. |
| A question fails with a rate-limit error | Groq and Gemini are both out of quota. Switch to `./start.sh ollama`; Groq's quota comes back over the next 24 hours. |
| Questions take minutes instead of seconds | Groq's daily quota is spent and Gemini is serving (or out too). The status dot says so. Switch to `./start.sh ollama`. |
| Documents panel is empty | Choose **Add the two sample documents**, or upload your own (.pdf, .txt, .md). |

For the presentation itself (checklist, demo questions and what each shows), see [docs/demo.md](docs/demo.md).
