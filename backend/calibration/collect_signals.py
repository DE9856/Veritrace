"""Collect every verification signal for the hand-labelled claims, once.

Runs the real models (the LLM set by LLM_PROVIDER, bge, DeBERTa) on each claim in a
labelled claims file against the two sample documents and saves the raw signals. Tuning
(tune.py) and evaluation (evaluate.py) then re-score those signals under different
settings without calling a model.

Run from backend/:
    python -m calibration.collect_signals                     # dev_claims.yaml -> signals.json
    python -m calibration.collect_signals --claims test_claims.yaml --out test_signals.json
Takes about 10 to 15 minutes with qwen3:4b-instruct on a laptop GPU, and about as long
on Groq, whose free tier allows 8000 tokens a minute. The fallback model is turned off,
so every LLM signal comes from one model.
"""

import argparse
import asyncio
import hashlib
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
from app.prompts import render
from app.providers.base import LLMError, RateLimitError
from app.services import build_services

HERE = Path(__file__).parent
SAMPLES = ["chandrayaan-3.md", "james-webb-space-telescope.md"]


def judge_prompt_version() -> str:
    """Identifies the judge prompt a verdict came from, so rejudge.py knows what to redo."""
    return hashlib.sha256(render("judge_system").encode()).hexdigest()[:12]


async def patient(fn, *args, **kwargs):
    """Run an LLM call, waiting out rate limits. The collection sends calls far faster
    than the app does, so Groq's tokens-per-minute limit outlasts the provider's own
    retries; a minute's wait always clears it."""
    waits = 10
    for attempt in range(waits + 1):
        try:
            return await fn(*args, **kwargs)
        except RateLimitError as error:
            if attempt == waits:
                raise
            wait = min(error.retry_after_s or 60.0, 120.0)
            print(f"      rate limited, waiting {wait:.0f}s", flush=True)
            await asyncio.sleep(wait)


class _Watched:
    """Passes calls to a provider and remembers the last error, which judge_claims
    swallows (the app then scores without a verdict)."""

    def __init__(self, provider):
        self.provider = provider
        self.error: LLMError | None = None

    async def generate_json(self, *args, **kwargs):
        try:
            return await self.provider.generate_json(*args, **kwargs)
        except LLMError as error:
            self.error = error
            raise


async def judge_strictly(claims: dict[int, str], sources, *, provider) -> dict:
    """judge_claims, but a failed call raises instead of returning no verdicts, so
    patient() can wait out a rate limit instead of saving the claim unjudged."""
    watched = _Watched(provider)
    result = await judge_claims(claims, sources, provider=watched)
    if watched.error:
        raise watched.error
    return result


def save(out: Path, settings: Settings, records: list[dict], **extra) -> None:
    """Write the records so far; a rerun with the same --out resumes from them."""
    payload = {
        "model": model_name(settings),
        "nli_model": settings.nli_model,
        "consistency_samples": settings.consistency_samples,
        **extra,
        "claims": records,
    }
    out.write_text(json.dumps(payload, indent=2) + "\n")


def resume(out: Path) -> list[dict]:
    return json.loads(out.read_text())["claims"] if out.exists() else []


async def collect(settings: Settings, claims_file: Path, out: Path) -> list[dict]:
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

    dev = yaml.safe_load(claims_file.read_text())["claims"]
    samples_by_question: dict[str, list[str]] = {}
    records = resume(out)
    done = {r["claim"] for r in records}
    for n, item in enumerate(dev, 1):
        start = time.perf_counter()
        question, text = item["question"], item["claim"]
        if text in done:
            continue
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
            samples_by_question[question] = await patient(
                sample_answers,
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
        judged = await patient(judge_strictly, {0: text}, sources, provider=services.provider)
        judgement = judged.get(0)

        records.append(
            {
                "question": question,
                "claim": text,
                "label": item["label"],
                "entailment": ev.support.entailment,
                "neutral": ev.support.neutral,
                "contradiction": ev.max_contradiction,
                "support_similarity": ev.support_similarity,
                "support_passage": ev.support_passage,
                "support_chunk": ev.support_source.text if ev.support_source else "",
                "document": ev.support_source.filename if ev.support_source else "",
                "new_words": ev.new_words,
                "new_numbers": ev.new_numbers,
                "novelty_share": ev.novelty_share,
                "consistency": consistency,
                "judge": judgement.verdict if judgement else None,
                "judge_reason": judgement.reason if judgement else None,
                "judge_prompt": judge_prompt_version(),
            }
        )
        r = records[-1]
        print(
            f"[{n:2}/{len(dev)}] {time.perf_counter() - start:4.1f}s  {item['label']:12} "
            f"E={r['entailment']:.2f} C={r['contradiction']:.2f} cons={consistency:.2f} "
            f"judge={r['judge']}  {text}",
            flush=True,
        )
        save(out, settings, records)
    return records


def model_name(settings: Settings) -> str:
    provider = settings.llm_provider
    return settings.ollama_model if provider == "ollama" else getattr(settings, f"{provider}_model")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--claims", default="dev_claims.yaml", help="claims file in calibration/")
    parser.add_argument("--out", default="signals.json", help="output file, in calibration/")
    args = parser.parse_args()
    out = HERE / args.out
    with tempfile.TemporaryDirectory() as tmp:
        settings = Settings(data_dir=Path(tmp), llm_fallback="")
        records = asyncio.run(collect(settings, HERE / args.claims, out))
    save(out, settings, records)
    print(f"\nSaved {len(records)} claims to {out.relative_to(BACKEND_DIR)}")


if __name__ == "__main__":
    main()
