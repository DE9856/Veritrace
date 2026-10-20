# Veritrace

**Hallucination-Aware Information Assistant** (M1-P5, Agentic AI)

Veritrace answers questions from your own documents and labels every claim in its answer as high-confidence, inferred, or potentially hallucinated, with a score and the evidence behind it. The full design is in [`docs/project-overview.html`](docs/project-overview.html), and progress is tracked in [`CHANGELOG.md`](CHANGELOG.md).

## Status

Phase 1 is complete: document ingestion, retrieval, and grounded answers with citations, served by a FastAPI backend on a local Ollama model. Claim verification and confidence labels come in Phases 2 and 3.

## Run the backend

Requires Python 3.12 (via [uv](https://docs.astral.sh/uv/)) and [Ollama](https://ollama.com).

```bash
cd backend
uv venv --python 3.12
source .venv/bin/activate
uv pip install torch --index-url https://download.pytorch.org/whl/cpu
uv pip install -r requirements.txt
cp .env.example .env

ollama pull qwen3:4b-instruct
uvicorn app.main:app --reload
```

The first start downloads the bge-small embedding model (about 130 MB). Interactive API docs are then at http://localhost:8000/docs.

## Try it

```bash
# Upload a document
curl -F "file=@samples/chandrayaan-3.md" localhost:8000/api/documents

# Ask a question
curl localhost:8000/api/chat -H 'content-type: application/json' \
  -d '{"question": "When did Vikram land and what did the rover find?"}'

# Check the model and index
curl localhost:8000/api/health
```

## Tests

```bash
cd backend
pytest        # uses a fake embedder and LLM, so Ollama does not need to be running
ruff check .
```
