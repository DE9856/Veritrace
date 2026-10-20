# Changelog

All notable changes to Veritrace, the Hallucination-Aware Information Assistant (M1-P5), are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Planned
- Phase 4: move the pipeline into a LangGraph state graph with the retrieval retry loop and the optional revise node, and stream each step to the client over SSE.

## [0.3.0] - 2026-10-20

Phase 3: full confidence scoring. Each claim's label now combines NLI with four more signals, and the weights and thresholds are tuned on hand-labelled claims.

### Added
- Self-labels: the generator tags every sentence `{HIGH}`, `{INFERRED}` or `{UNSURE}`. Tags are read per sentence and removed from the displayed answer.
- Consistency node (`agent/nodes/consistency.py`): resamples the answer 3 times at temperature 0.8 and scores each claim by how strongly the samples entail it (the SelfCheckGPT idea). A sampling failure leaves the signal out instead of failing the request.
- Judge node (`agent/nodes/judge.py`): one LLM call reviews every claim NLI did not cleanly confirm (entailment below the high threshold, or a strong contradiction) and answers derivable, contradicted or unsupported with a short reason. The reason length is capped in the JSON schema sent to the model.
- Novelty check (`verification/novelty.py`): claim words and numbers missing from the supporting passage. NLI entails deductions ("about three weeks after launch") as strongly as statements; a new number or a large share of new words marks the claim inferred, and the reason lists the new words.
- Weighted score of entailment, consistency, retrieval relevance (claim-to-passage similarity) and self-label, with missing signals dropped and weights renormalised. Labels follow ordered rules: judge contradiction; judge rescue of an unconfirmed claim to inferred; NLI contradiction; unsupported; then strong entailment or the score, with novelty able to demote high to inferred.
- `backend/config.yaml` holds the weights and thresholds, loaded below environment variables and `.env`.
- Calibration (`backend/calibration/`): 39 hand-labelled claims over two documents, a script that collects every signal once with the real models (`signals.json`), and a script that grid-searches thresholds and weights, reports confusion matrices, and checks the result by tuning on one document and testing on the other.
- Second sample document, `samples/james-webb-space-telescope.md`.
- Response fields: `consistency`, `retrieval`, `self_label`, `judge` and `new_terms` per claim; timings for `sample`, `consistency` and `judge`.
- 36 new tests, 73 in total.

### Changed
- NLI reads each window twice, with and without the document title, when the first reading is not decisive. Support counts if either reading shows it; a contradiction counts only if both agree. The title helps link "Chandrayaan-3" to "the Vikram lander" but blurred "India became the first to land near the south pole" (entailment 0.52 with the title, 0.85 without).
- The pipeline overlaps GPU and CPU work: NLI verification runs while answers are being resampled, and the consistency check runs while the judge works. Questions take 23 to 30 seconds locally, down from 30 to 39.
- Score weights tuned from 0.55 / 0.20 / 0.15 / 0.10 to 0.65 / 0.15 / 0.10 / 0.10 (entailment / consistency / retrieval / self-label). The thresholds came out unchanged. On the 39 labelled claims: 72% accuracy before the novelty check and wider judging, 92% after, 97% (macro-F1 0.97) with the tuned weights. Tuning on either document alone finds no better settings than these, which score 100% on the JWST claims and 95% on the Chandrayaan-3 claims. Lowering the consistency weight also matches an observed weakness: resampled answers that state only part of a long claim do not entail it.
- Ruff's SIM905 rule is disabled, so word lists can stay readable as a split string.

### Fixed
- Garbled names in extracted claims ("Praginois", "Prag่าน", "Chandray-2" for Pragyan and Chandrayaan-2). This is the 4B model at temperature 0, with or without JSON mode. A capitalised word missing from the answer that starts like, and closely matches, a name in it is repaired.
- A citation used as the subject of a sentence ("[S1] mentions ...") was moved to the previous sentence; a lone "." after a refusal became its own sentence; "No source addresses ..." was not recognised as a statement about the sources.

## [0.2.0] - 2026-10-20

Phase 2: claim verification. Every answer is split into atomic claims, each claim is checked against the sources with an NLI model, and every claim and sentence gets a label.

### Added
- Extract node (`agent/nodes/extract.py`): splits the answer into sentences, keeping citations with the right sentence, then asks the LLM for atomic, self-contained claims as structured JSON. If extraction fails, whole sentences are checked instead, so verification is never skipped. A cited sentence that comes back with no claims is also checked whole.
- NLI verifier (`verification/nli.py`): `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` on the CPU, reading the label order from the model config.
- Verify node (`agent/nodes/verify.py`): splits sources into 3-sentence windows and checks each claim against its 4 best-matching windows plus the best window of every source its sentence cited. Windows are ranked by 70% bge similarity and 30% shared words, because embeddings treat dates and numbers loosely. Each NLI premise is prefixed with its document title, because passages often name the subject only indirectly ("the Vikram lander" rather than "Chandrayaan-3").
- Phase 2 scoring (`verification/scoring.py`): entailment of 0.75 or more is high confidence, 0.45 or more is inferred, and anything lower is hallucinated. Contradiction of 0.7 or more makes a claim hallucinated unless another passage clearly supports it, since NLI often reads a passage about a different event as a contradiction. Each claim records its NLI verdict, signals, evidence source, whether that source was cited, and a reason.
- Roll-up: a sentence takes the label of its weakest claim; answer confidence is the claim-length-weighted average score, with counts per label.
- `/api/chat` response fields from the API contract: `answer_confidence`, `counts`, `sentences` (each with its claims), and `extraction_fallback`. Timings now include `extract` and `verify`. `/api/health` reports the NLI model.
- Claim-extraction prompts with a worked example; NLI and window settings in `config.py`.
- Statements about what the sources do not cover ("The documents do not mention ...") are recognised and left unlabelled instead of being checked as claims.
- Document titles: taken from PDF metadata, else a heading-like first line, else the filename. Stored in each chunk's ChromaDB metadata (older chunks fall back to the filename) and shown to the LLM with each source.
- 21 new tests (scoring rules, support versus unrelated contradiction, roll-up, answer splitting, statements about the sources, evidence windows and ranking, titles, labelled chat responses, contradiction, refusal and extraction fallback, Ollama offline handling), 37 in total.

### Verified
- End to end with `qwen3:4b-instruct`, bge-small and DeBERTa on the sample document. A correct answer about the landing and the rover's findings: 11 of 11 claims high confidence. A causal explanation of why the mission ended: labelled inferred. A comparison of Chandrayaan-2 and Chandrayaan-3: 5 of 5 high. In a hand-written answer, an invented claim (water ice) and an unsupported deduction were flagged as hallucinated, and a wrong launch date was flagged as contradicted (1.00). Extraction takes 4 to 5 seconds and verification 2 to 3 seconds per answer.

### Fixed
- The NLI model loaded in float16, the default in Transformers 5, which is about 4x slower on a CPU. It now loads in float32 on the CPU.
- When Ollama was not running, its client raised the built-in `ConnectionError`, which was not caught: `/api/chat` returned a 500 instead of a 503, and `/api/health` failed instead of reporting `degraded`.

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
