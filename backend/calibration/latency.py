"""Time the full agent per question for the model set by LLM_PROVIDER.

Runs the "test" questions of answer_questions.yaml through the live agent (fallback
off) and saves the seconds per question and per step to latency_<provider>.json, which
evaluate.py adds to its report. For a hosted model it also saves the tokens each
question used, which tells how many questions fit in a daily token cap.

Run from backend/:
    LLM_PROVIDER=groq python -m calibration.latency
    LLM_PROVIDER=ollama python -m calibration.latency
"""

import asyncio
import json
import tempfile
import time
from pathlib import Path

import yaml

from app.agent.graph import Agent
from app.config import BACKEND_DIR, Settings
from app.ingestion.pipeline import ingest_file
from app.schemas import ChatRequest
from app.services import build_services
from calibration.collect_signals import SAMPLES, model_name

HERE = Path(__file__).parent


async def measure(settings: Settings, questions: list[str]) -> list[dict]:
    services = build_services(settings)
    for i, name in enumerate(SAMPLES):
        ingest_file(
            BACKEND_DIR / "samples" / name,
            document_id=f"sample{i}",
            filename=name,
            embedder=services.embedder,
            store=services.store,
            settings=settings,
        )
    agent = Agent(services)
    results = []
    for question in questions:
        start = time.perf_counter()
        tokens_before = getattr(services.provider, "tokens_used", None)
        response = await agent.run(ChatRequest(question=question))
        seconds = round(time.perf_counter() - start, 1)
        result = {"question": question, "seconds": seconds, "steps_ms": response.timings_ms}
        if tokens_before is not None:
            result["tokens"] = services.provider.tokens_used - tokens_before
        results.append(result)
        print(f"{seconds:5.1f}s  {result.get('tokens', '-')} tokens  {question}", flush=True)
    return results


def main() -> None:
    items = yaml.safe_load((HERE / "answer_questions.yaml").read_text())["questions"]
    questions = [q["question"] for q in items if q["split"] == "test"]
    with tempfile.TemporaryDirectory() as tmp:
        settings = Settings(data_dir=Path(tmp), llm_fallback="")
        results = asyncio.run(measure(settings, questions))
    out = HERE / f"latency_{settings.llm_provider}.json"
    payload = {"model": model_name(settings), "questions": results}
    out.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Saved {out.name}")


if __name__ == "__main__":
    main()
