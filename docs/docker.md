# Running the backend in Docker

Optional. The normal way to run Veritrace locally is `./start.sh` (see the README), and the deployment runs the whole app with Docker Compose ([deployment.md](deployment.md)). The image on its own is useful on a machine without the Python setup.

The image holds the backend with CPU-only PyTorch and the embedding and NLI models already downloaded, so it starts without a 1 GB download. The LLM is called over the network (Groq, then the backup Groq key, then Gemini). It needs about 1.5 GB of RAM.

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
| `LLM_FALLBACK` | `groq_backup,gemini` | Tried in order; each only if its key (`GROQ_BACKUP_API_KEY`, `GEMINI_API_KEY`) is set |
| `CONSISTENCY_SAMPLES` | `2` | Fewer hosted calls per question |
| `SEED_SAMPLES` | `true` | Index `samples/` when the store is empty |
| `PORT` | `8000` | |

Any value in `.env` overrides these.
