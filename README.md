# Veritrace

**Hallucination-Aware Information Assistant** (M1-P5, Agentic AI)

Veritrace answers questions from your own documents and labels every claim in its answer as high-confidence, inferred, or potentially hallucinated, with a score and the evidence behind it. The full design is in [`docs/project-overview.html`](docs/project-overview.html), and progress is tracked in [`CHANGELOG.md`](CHANGELOG.md).

## Status

All six phases are built. Veritrace is a LangGraph agent that plans its searches, retries with new queries when the evidence is weak, answers with citations, splits the answer into atomic claims, and labels every claim as high confidence, inferred, or potentially hallucinated. The web app streams each agent step and shows how every claim was checked. It runs on Groq (`openai/gpt-oss-120b`), with a second Groq key and then Gemini (`gemini-3.5-flash`) as fallbacks. It deploys to one AWS EC2 instance ([`docs/deployment.md`](docs/deployment.md)); [`docs/demo.md`](docs/demo.md) has the demo checklist and questions.

## Quick start

**[STARTUP.md](STARTUP.md)** has every step to turn Veritrace on: one-time setup, starting and stopping, a manual start and common problems.

With the backend and frontend set up as below:

```bash
./start.sh          # Groq, then the backup Groq key, then Gemini
./start.sh gemini   # Gemini first, Groq as fallback
```

This starts the backend on port 8000 and the frontend on port 3000, indexes the two sample documents on first start, and stops both on Ctrl+C. Open http://localhost:3000.

## Run the backend

Requires Python 3.12 (via [uv](https://docs.astral.sh/uv/)).

```bash
cd backend
uv venv --python 3.12
source .venv/bin/activate
uv pip install torch --index-url https://download.pytorch.org/whl/cpu
uv pip install -r requirements-dev.txt   # runtime plus pytest and ruff
cp .env.example .env   # then paste GROQ_API_KEY (and GROQ_BACKUP_API_KEY, GEMINI_API_KEY)
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

# Check a given answer instead of writing one (check mode): here with a planted wrong date
curl localhost:8000/api/chat -H 'content-type: application/json' \
  -d '{"question": "When did Vikram land?", "answer": "Vikram landed on 23 September 2023."}'

# The agent graph as a Mermaid diagram
curl localhost:8000/api/chat/graph

# Check the model and index
curl localhost:8000/api/health
```

## Run the frontend

Requires Node.js 20 or newer. With the backend running on port 8000:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000/app, choose **Add the two sample documents**, and ask one of the suggested questions. Select a highlighted sentence to see its claim check, or a citation to read the source passage.

## Calibration and evaluation

The labels are checked against hand labels on a dev set (used to design the rules and tune the settings) and two held-out sets (only scored): test, and fresh, written in 0.9.0 after test's errors had been read to find what to fix. Results, with an ablation of each signal, the calibration of the confidence score (reliability diagram, selective answering) and the latency per question, are in [docs/evaluation.md](docs/evaluation.md).

```bash
cd backend
# Collect the raw signals once per model (reruns resume where they stopped)
export LLM_PROVIDER=groq                # or gemini
python -m calibration.collect_signals --out ${LLM_PROVIDER}_dev_signals.json
python -m calibration.collect_signals --claims test_claims.yaml --out ${LLM_PROVIDER}_test_signals.json
python -m calibration.collect_signals --claims fresh_claims.yaml --out ${LLM_PROVIDER}_fresh_signals.json
python -m calibration.collect_answers   # claims from real answers, labelled in answer_labels.yaml
python -m calibration.latency           # seconds (and tokens, on Groq) per question

python -m calibration.evaluate --write  # instant: writes docs/evaluation.md
python -m calibration.tune              # instant: grid search on the older signals.json
python -m calibration.rejudge ${LLM_PROVIDER}_dev_signals.json  # after changing the judge prompt

# Synthetic hallucinations: true claims with one fact changed (no model needed to make them)
python -m calibration.synthetic         # writes synthetic_claims.yaml
CONSISTENCY_SAMPLES=0 python -m calibration.collect_signals --claims synthetic_claims.yaml --out ${LLM_PROVIDER}_synthetic_signals.json
```

On Groq, collecting every set uses more than the free tier's 200,000 tokens a day, so it takes several days: `calibration/run_groq.sh` runs the steps in order and resumes after each quota reset.

## Tests

```bash
cd backend
pytest        # uses a fake embedder and LLM, so no API keys are needed
ruff check .
```

## Docker

The backend also runs in a container; see [`docs/docker.md`](docs/docker.md). The deployment runs the backend, the frontend and Caddy with Docker Compose on EC2; see [`docs/deployment.md`](docs/deployment.md).
