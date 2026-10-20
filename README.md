# Veritrace

**Hallucination-Aware Information Assistant** (M1-P5, Agentic AI)

Veritrace answers questions from your own documents and labels every claim in its answer as high-confidence, inferred, or potentially hallucinated, with a score and the evidence behind it. The full design is in [`docs/project-overview.html`](docs/project-overview.html), and progress is tracked in [`CHANGELOG.md`](CHANGELOG.md).

## Status

Phases 1 to 4 are complete. Veritrace is a LangGraph agent: it plans its searches and retries with new queries when the evidence is weak, answers with citations, splits the answer into atomic claims, and labels every claim as high confidence, inferred, or potentially hallucinated. Each label combines NLI against the sources, self-consistency across resampled answers, the generator's own confidence tag, an LLM judge, and a check for words the source does not contain. In safe mode it also returns a rewritten answer without the flagged claims. Every step streams to the client over Server-Sent Events. The frontend comes in Phase 5.

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

The first start downloads the bge-small embedding model (about 130 MB) and the DeBERTa NLI model (about 700 MB). Interactive API docs are then at http://localhost:8000/docs.

## Try it

```bash
# Upload a document
curl -F "file=@samples/chandrayaan-3.md" localhost:8000/api/documents

# Ask a question
curl localhost:8000/api/chat -H 'content-type: application/json' \
  -d '{"question": "When did Vikram land and what did the rover find?"}'

# Follow the agent step by step (Server-Sent Events), with safe mode on
curl -N localhost:8000/api/chat/stream -H 'content-type: application/json' \
  -d '{"question": "What does the mission mean for future missions?", "safe_mode": true}'

# The agent graph as a Mermaid diagram
curl localhost:8000/api/chat/graph

# Check the model and index
curl localhost:8000/api/health
```

## Calibration

```bash
cd backend
python -m calibration.collect_signals   # about 7 minutes: runs the real models on 39 labelled claims
python -m calibration.tune              # instant: re-scores them under a grid of settings
python -m calibration.tune --write      # also writes the best values into config.yaml
```

## Tests

```bash
cd backend
pytest        # uses a fake embedder and LLM, so Ollama does not need to be running
ruff check .
```
