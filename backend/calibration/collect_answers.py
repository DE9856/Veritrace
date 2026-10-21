"""Collect the signals for claims from real answers, for labelling by hand.

collect_signals.py checks hand-written claims, which mostly copy the documents' words.
The claims a model actually writes paraphrase more, carry the generator's self-label and
come with citations, so this runs the real agent on the questions in
answer_questions.yaml and saves every extracted claim with its raw signals.

The claims are then labelled by hand in answer_labels.yaml (claim text -> label), using
the same definitions as dev_claims.yaml. evaluate.py joins the two; a claim without a
label is left out and listed.

Run from backend/ (LLM_PROVIDER picks the model; the fallback is turned off):
    python -m calibration.collect_answers        # -> <provider>_answers.json, resumable
"""

import argparse
import asyncio
import json
import tempfile
import time
from pathlib import Path
from typing import Any

import yaml

from app.agent.graph import Agent
from app.agent.state import AgentState
from app.config import BACKEND_DIR, Settings
from app.ingestion.pipeline import ingest_file
from app.schemas import ChatRequest
from app.services import build_services
from app.verification.scoring import needs_judgement
from calibration.collect_signals import SAMPLES, judge_strictly, model_name, patient

HERE = Path(__file__).parent


class RecordingAgent(Agent):
    """The live agent, except that the judge sees every claim and the score node saves
    each claim's signals before scoring them as the app would."""

    def __init__(self, services):
        super().__init__(services)
        self.records: list[dict[str, Any]] = []

    async def judge(self, state: AgentState) -> dict[str, Any]:
        everything = {i: ev.text for i, ev in enumerate(state["evidence"])}
        return {
            "judgements": await judge_strictly(everything, state["sources"], provider=self.provider)
        }

    async def score(self, state: AgentState) -> dict[str, Any]:
        question = state["request"].question
        for i, (ev, cons) in enumerate(zip(state["evidence"], state["consistency"], strict=True)):
            judgement = state["judgements"].get(i)
            self.records.append(
                {
                    "question": question,
                    "claim": ev.text,
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
                    "consistency": cons,
                    "self_label": ev.self_label,
                    "cited": bool(ev.sentence_citations),
                    "judge": judgement.verdict if judgement else None,
                    "judge_reason": judgement.reason if judgement else None,
                }
            )
        # Score as the app would: only claims the app sends to the judge use its verdict.
        for ev, cons in zip(state["evidence"], state["consistency"], strict=True):
            ev.consistency = cons
        live = {
            i: j
            for i, j in state["judgements"].items()
            if needs_judgement(state["evidence"][i], self.settings)
        }
        return await super().score({**state, "judgements": live})


async def collect(settings: Settings, questions: list[dict], out: Path) -> None:
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
    agent = RecordingAgent(services)
    saved = json.loads(out.read_text()) if out.exists() else {"answers": [], "claims": []}
    records, answers = saved["claims"], saved["answers"]
    done = {a["question"] for a in answers}
    for n, item in enumerate(questions, 1):
        if item["question"] in done:
            continue
        start = time.perf_counter()
        first = len(agent.records)
        response = await patient(agent.run, ChatRequest(question=item["question"]))
        claims = agent.records[first:]
        app_labels = [c.label for s in response.sentences for c in s.claims]
        for record, label in zip(claims, app_labels, strict=True):
            record["split"] = item["split"]
            record["app_label"] = label
        records.extend(claims)
        answers.append(
            {
                "question": item["question"],
                "split": item["split"],
                "answer": response.answer,
                "seconds": round(time.perf_counter() - start, 1),
            }
        )
        print(
            f"[{n:2}/{len(questions)}] {answers[-1]['seconds']:5.1f}s  {len(claims):2} claims  "
            f"{item['question']}",
            flush=True,
        )
        save(out, settings, answers, records)


def save(out: Path, settings: Settings, answers: list[dict], records: list[dict]) -> None:
    """Write after every answer; a rerun with the same --out resumes from it."""
    payload = {
        "model": model_name(settings),
        "nli_model": settings.nli_model,
        "consistency_samples": settings.consistency_samples,
        "answers": answers,
        "claims": records,
    }
    out.write_text(json.dumps(payload, indent=2) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", help="file in calibration/, default <provider>_answers.json")
    args = parser.parse_args()
    questions = yaml.safe_load((HERE / "answer_questions.yaml").read_text())["questions"]
    with tempfile.TemporaryDirectory() as tmp:
        settings = Settings(data_dir=Path(tmp), llm_fallback="")
        out = HERE / (args.out or f"{settings.llm_provider}_answers.json")
        asyncio.run(collect(settings, questions, out))
    saved = json.loads(out.read_text())
    claims, answers = len(saved["claims"]), len(saved["answers"])
    print(f"\nSaved {claims} claims from {answers} answers to {out.name}")


if __name__ == "__main__":
    main()
