# Changelog

All notable changes to Veritrace, the Hallucination-Aware Information Assistant (M1-P5), are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Project name: Veritrace. Added to the project overview document.
- `.gitignore` covering secrets (`.env`), the Python virtual environment and caches, runtime data (ChromaDB, uploads, SQLite), Node/Next.js build output, and editor files.

### Planned
- Phase 1: FastAPI skeleton, Ollama provider, document ingestion pipeline (PyMuPDF, chunking, bge-small embeddings, ChromaDB), grounded answers with citations.

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
