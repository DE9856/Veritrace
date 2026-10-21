"""Judge the saved claims again, after a change to the judge prompt.

Only the judge verdict depends on the prompt; NLI, consistency and novelty stay as
collected. Each claim is judged on its own against the passages retrieved for its
question, as collect_signals.py does. Files are updated in place, and a rerun skips the
claims already judged with the current prompt.

Run from backend/ (LLM_PROVIDER picks the model; the fallback is turned off):
    python -m calibration.rejudge ollama_dev_signals.json ollama_test_signals.json
"""

import argparse
import asyncio
import json
import tempfile
import time
from pathlib import Path

from app.agent.nodes.retrieve import retrieve
from app.config import BACKEND_DIR, Settings
from app.ingestion.pipeline import ingest_file
from app.services import build_services
from calibration.collect_signals import SAMPLES, judge_prompt_version, judge_strictly, patient

HERE = Path(__file__).parent


async def rejudge(settings: Settings, files: list[Path]) -> None:
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
    version = judge_prompt_version()
    sources_by_question: dict[str, list] = {}
    for path in files:
        data = json.loads(path.read_text())
        records = data["claims"]
        for n, record in enumerate(records, 1):
            if record.get("judge_prompt") == version:
                continue
            start = time.perf_counter()
            question = record["question"]
            if question not in sources_by_question:
                sources_by_question[question] = await retrieve(
                    question, embedder=services.embedder, store=services.store, k=settings.top_k
                )
            judged = await patient(
                judge_strictly,
                {0: record["claim"]},
                sources_by_question[question],
                provider=services.provider,
            )
            judgement = judged.get(0)
            before = record.get("judge")
            record["judge"] = judgement.verdict if judgement else None
            record["judge_reason"] = judgement.reason if judgement else None
            record["judge_prompt"] = version
            print(
                f"{path.name} [{n:2}/{len(records)}] {time.perf_counter() - start:4.1f}s "
                f"{record.get('label', '?'):12} {before} -> {record['judge']}  {record['claim']}",
                flush=True,
            )
            path.write_text(json.dumps(data, indent=2) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("files", nargs="+", help="signals or answers files in calibration/")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        settings = Settings(data_dir=Path(tmp), llm_fallback="")
        asyncio.run(rejudge(settings, [HERE / name for name in args.files]))


if __name__ == "__main__":
    main()
