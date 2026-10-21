# Running the backend in Docker

Optional. The normal way to run Veritrace is `./start.sh` (see the README). The Docker image is useful on a machine without the Python setup, or to show that the backend is self-contained.

The image holds the backend with CPU-only PyTorch and the embedding and NLI models already downloaded, so it starts without a 1 GB download. The LLM is called over the network (Groq, with Gemini as fallback), so the image cannot run the offline Ollama mode. It needs about 1.5 GB of RAM.

## Build and run

From `backend/`:

```bash
docker build -t veritrace-backend .     # about 10 minutes the first time, 3.7 GB
docker run --rm -p 8000:8000 --env-file .env veritrace-backend
```

`.env` is passed at run time only; `.dockerignore` keeps it out of the image. The container's disk is fresh on every run, so the two sample documents are indexed at startup (`SEED_SAMPLES=true`) and uploaded documents are lost when it stops.

Check it with `curl localhost:8000/api/health`, which should report `"status": "ok"` and two documents. The frontend then runs as usual (`cd frontend && npm run dev`) and reaches the container on port 8000.

## Defaults in the image

| Setting | Value | Notes |
|---|---|---|
| `LLM_PROVIDER` | `groq` | Needs `GROQ_API_KEY` |
| `LLM_FALLBACK` | `gemini` | Used only if `GEMINI_API_KEY` is set |
| `CONSISTENCY_SAMPLES` | `2` | Fewer hosted calls per question |
| `SEED_SAMPLES` | `true` | Index `samples/` when the store is empty |
| `PORT` | `8000` | |

Any value in `.env` overrides these.
