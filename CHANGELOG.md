# Changelog

All notable changes to Veritrace, the Hallucination-Aware Information Assistant (M1-P5), are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Planned
- Phase 2: claim extraction (LLM, JSON output) and claim verification with the DeBERTa NLI model, with first labels based on the NLI verdict.

## [0.1.0] - 2026-10-20

Phase 1: foundations and RAG. The backend ingests documents and answers questions from them with citations.

### Added
- FastAPI backend (`backend/app/`) with an app factory, CORS for the Next.js dev server, and shared services built once at startup.
- Settings loaded from `backend/.env` through pydantic-settings, with `.env.example` documenting every option.
- LLM provider interface (`providers/base.py`) with `generate`, `generate_json`, `sample` and `health`, plus an Ollama implementation and a factory that selects the provider from `LLM_PROVIDER`.
- Ingestion pipeline: PyMuPDF text extraction with line-wrap and hyphen cleanup, pysbd sentence splitting, page-bounded chunks of up to 400 tokens with 60 tokens of sentence overlap, bge-small-en-v1.5 embeddings, and storage in a persistent ChromaDB collection using cosine distance.
- SQLite document records (SQLModel) with SHA-256 duplicate detection, so uploading the same file twice does not index it twice.
- Retrieve node (top-k chunks labelled S1..Sk) and generate node (grounded answer with inline `[S1]` citations; citations to labels that were never provided are reported as invalid).
- Grounded-answer prompts in `app/prompts/`, including an exact refusal sentence when the sources lack the answer.
- API endpoints: `POST/GET /api/documents`, `GET/DELETE /api/documents/{id}`, `GET /api/chunks/{id}`, `POST /api/chat`, `GET /api/health`.
- Sample document `backend/samples/chandrayaan-3.md`.
- 16 tests (chunker, citation parsing, reasoning cleanup, full API flow) that use a fake embedder and LLM; Ruff lint and format configuration in `pyproject.toml`.
- `README.md` with setup, run and test instructions.
- Project name Veritrace and a `.gitignore` covering secrets, the virtual environment, runtime data, Node build output and editor files.

### Changed
- Development model switched from `qwen3:4b` to `qwen3:4b-instruct`. Ollama's `qwen3:4b` tag is the thinking-only Qwen3-4B-Thinking-2507 build, which ignores `think=False`: its reasoning leaked into answers and each answer took 25 to 80 seconds. The instruct build is the same size and answers in 1 to 2 seconds.
- Project overview: project structure updated to match the code, and the development model renamed.

## [0.0.1] - 2026-10-20

Preliminaries: design and environment setup.

### Added
- Project overview document (`docs/project-overview.html`) covering the approach, confidence labels, agent pipeline, scoring formula, tech stack, architecture, API contract, deployment and build roadmap.
- `backend/requirements.txt` with backend dependencies (FastAPI, LangGraph, ChromaDB, sentence-transformers, transformers, google-genai, ollama, PyMuPDF, pysbd, SQLModel, pytest, ruff).
- Python 3.12 virtual environment at `backend/.venv`, created with uv.
- PyTorch 2.14.1 CPU build, installed separately so the GPU's 4 GB VRAM stays free for Ollama.
- Local development model `qwen3:4b` pulled through Ollama.

### Decided
- Grounding: answers come from a knowledge base of uploaded documents.
- Detection: an ensemble led by claim-level NLI verification (DeBERTa), with self-consistency sampling and the model's own confidence labels as secondary signals.
- Labels: claims are checked individually; sentences are displayed with the label of their weakest claim.
- Models: `qwen3:4b` on Ollama during development, with thinking mode off. The final version switches to the Gemini API free tier, with Sarvam or Groq as a fallback.
- Stack: FastAPI and LangGraph backend, Next.js frontend, ChromaDB vector store, bge-small-en-v1.5 embeddings.
- Deployment: backend on Hugging Face Spaces, frontend on Vercel.
