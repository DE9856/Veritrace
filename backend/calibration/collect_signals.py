"""Collect every verification signal for the hand-labelled claims, once.

Runs the real models (Ollama, bge, DeBERTa) on each claim in dev_claims.yaml against the
two sample documents and saves the raw signals to signals.json. Tuning (tune.py) then
re-scores those signals under different thresholds and weights without calling a model.

Run from backend/:  python -m calibration.collect_signals
Takes about 10 to 15 minutes with qwen3:4b-instruct on a laptop GPU.
"""

import asyncio
import json
import tempfile
import time
from pathlib import Path

import yaml

from app.agent.nodes.consistency import consistency_scores, sample_answers
from app.agent.nodes.extract import AnswerSentence, ExtractedClaim
from app.agent.nodes.judge import judge_claims
from app.agent.nodes.retrieve import retrieve
from app.agent.nodes.verify import verify
from app.config import BACKEND_DIR, Settings
from app.ingestion.pipeline import ingest_file
from app.services import build_services

HERE = Path(__file__).parent
SAMPLES = ["chandrayaan-3.md", "james-webb-space-telescope.md"]


async def collect(settings: Settings) -> list[dict]:
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

    dev = yaml.safe_load((HERE / "dev_claims.yaml").read_text())["claims"]
    samples_by_question: dict[str, list[str]] = {}
    records = []
    for n, item in enumerate(dev, 1):
        start = time.perf_counter()
        question, text = item["question"], item["claim"]
        sources = await retrieve(
            question, embedder=services.embedder, store=services.store, k=settings.top_k
        )
        # A hand-written claim has no citations and no self-label.
        sentence = AnswerSentence(0, text, text, citations=[])
        claim = ExtractedClaim(0, text)
        [ev] = await verify(
            [claim],
            [sentence],
            sources,
            embedder=services.embedder,
            nli=services.nli,
            window_size=settings.nli_window_sentences,
            per_claim=settings.nli_windows_per_claim,
        )
        if question not in samples_by_question:
            samples_by_question[question] = await sample_answers(
                question,
                sources,
                provider=services.provider,
                n=settings.consistency_samples,
                temperature=settings.sample_temperature,
            )
        [consistency] = await consistency_scores(
            [claim], samples_by_question[question], nli=services.nli
        )
        # Judge every claim; tune.py applies the verdict only where the candidate
        # thresholds would have sent the claim to the judge.
        judgement = (await judge_claims({0: text}, sources, provider=services.provider)).get(0)

        records.append(
            {
                "question": question,
                "claim": text,
                "label": item["label"],
                "entailment": ev.support.entailment,
                "neutral": ev.support.neutral,
                "contradiction": ev.max_contradiction,
                "support_similarity": ev.support_similarity,
                "new_words": ev.new_words,
                "new_numbers": ev.new_numbers,
                "novelty_share": ev.novelty_share,
                "consistency": consistency,
                "judge": judgement.verdict if judgement else None,
                "judge_reason": judgement.reason if judgement else None,
            }
        )
        r = records[-1]
        print(
            f"[{n:2}/{len(dev)}] {time.perf_counter() - start:4.1f}s  {item['label']:12} "
            f"E={r['entailment']:.2f} C={r['contradiction']:.2f} cons={consistency:.2f} "
            f"judge={r['judge']}  {text}"
        )
    return records


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        settings = Settings(data_dir=Path(tmp))
        records = asyncio.run(collect(settings))
    out = HERE / "signals.json"
    payload = {
        "model": settings.ollama_model,
        "nli_model": settings.nli_model,
        "consistency_samples": settings.consistency_samples,
        "claims": records,
    }
    out.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"\nSaved {len(records)} claims to {out.relative_to(BACKEND_DIR)}")


if __name__ == "__main__":
    main()
