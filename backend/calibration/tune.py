"""Tune the confidence thresholds and weights on the hand-labelled claims.

Re-scores the saved signals (signals.json, from collect_signals.py) under a grid of
settings, using the same score_claim as the live pipeline, and reports which settings
label the claims best. No model is called, so this runs in seconds.

Run from backend/:
    python -m calibration.tune            # report the current config and the best found
    python -m calibration.tune --write    # also write the best values into config.yaml
"""

import argparse
import itertools
import json
import re
from collections import Counter
from pathlib import Path

from app.config import DEFAULT_CONFIG_YAML, Settings
from app.schemas import SourceChunk
from app.verification.nli import NLIScores
from app.verification.scoring import ClaimEvidence, needs_judgement, score_claim

HERE = Path(__file__).parent
LABELS = ("high", "inferred", "hallucinated")
WEIGHT_KEYS = ("weight_entailment", "weight_consistency", "weight_retrieval", "weight_self_label")
GRID = {
    "high_threshold": [0.65, 0.7, 0.75, 0.8, 0.85],
    "inferred_threshold": [0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
    "contradiction_threshold": [0.6, 0.7, 0.8, 0.9],
    "strong_entailment": [0.8, 0.85, 0.9, 0.95],
    "novelty_threshold": [0.15, 0.2, 0.25, 0.3, 0.4],
    "weights": [
        (0.55, 0.20, 0.15, 0.10),
        (0.60, 0.20, 0.10, 0.10),
        (0.65, 0.15, 0.10, 0.10),
        (0.50, 0.25, 0.15, 0.10),
        (0.45, 0.30, 0.15, 0.10),
        (0.55, 0.25, 0.10, 0.10),
    ],
}
JWST_WORDS = ("JWST", "Webb", "MIRI", "NIRCam")
# Signals score_claim can use. NLI (entailment, contradiction, passage match) is always on;
# the ablation in evaluate.py switches the others off one at a time.
ALL_SIGNALS = frozenset({"novelty", "judge", "consistency", "self_label"})
_SOURCE = SourceChunk(
    label="S1",
    chunk_id="c",
    document_id="d",
    filename="f",
    title="t",
    page=1,
    text="",
    similarity=1,
)


def document(record: dict) -> str:
    if record.get("document"):
        return "jwst" if "webb" in record["document"] else "chandrayaan"
    text = record["question"] + record["claim"]
    return "jwst" if any(w in text for w in JWST_WORDS) else "chandrayaan"


def predict(record: dict, settings: Settings, signals: frozenset[str] = ALL_SIGNALS) -> str:
    entail, contra = record["entailment"], record["contradiction"]
    novel = "novelty" in signals
    ev = ClaimEvidence(
        sentence_index=0,
        text=record["claim"],
        sentence_citations=[],
        support=NLIScores(entail, record["neutral"], contra),
        support_source=_SOURCE,
        max_contradiction=contra,
        contradiction_source=_SOURCE,
        support_similarity=record["support_similarity"],
        new_words=record.get("new_words", []) if novel else [],
        new_numbers=record.get("new_numbers", []) if novel else [],
        novelty_share=record.get("novelty_share", 0.0) if novel else 0.0,
        consistency=record["consistency"] if "consistency" in signals else None,
        # Hand-written claims have no self-label; claims from real answers do.
        self_label=record.get("self_label") if "self_label" in signals else None,
    )
    # Every claim was judged during collection; use the verdict only where these
    # settings would have sent the claim to the judge.
    if "judge" in signals and needs_judgement(ev, settings):
        ev.judge, ev.judge_reason = record["judge"], record["judge_reason"]
    return score_claim(ev, settings).label


def evaluate(records: list[dict], settings: Settings) -> tuple[float, float, Counter]:
    confusion: Counter = Counter()
    for r in records:
        confusion[(r["label"], predict(r, settings))] += 1
    accuracy = sum(confusion[(lab, lab)] for lab in LABELS) / len(records)
    f1s = []
    for lab in LABELS:
        tp = confusion[(lab, lab)]
        predicted = sum(confusion[(g, lab)] for g in LABELS)
        actual = sum(confusion[(lab, p)] for p in LABELS)
        precision = tp / predicted if predicted else 0.0
        recall = tp / actual if actual else 0.0
        f1s.append(2 * precision * recall / (precision + recall) if precision + recall else 0.0)
    return accuracy, sum(f1s) / len(f1s), confusion


def candidates(base: Settings):
    keys = [k for k in GRID if k != "weights"]
    for values in itertools.product(*(GRID[k] for k in keys), GRID["weights"]):
        update = dict(zip(keys, values[:-1], strict=True))
        update.update(zip(WEIGHT_KEYS, values[-1], strict=True))
        if update["inferred_threshold"] >= update["high_threshold"]:
            continue
        yield base.model_copy(update=update)


def distance(a: Settings, b: Settings) -> float:
    keys = [k for k in GRID if k != "weights"] + list(WEIGHT_KEYS)
    return sum(abs(getattr(a, k) - getattr(b, k)) for k in keys)


def search(records: list[dict], base: Settings) -> Settings:
    """Best macro-F1, then accuracy; ties go to the settings closest to the current ones,
    so the tuning moves values only when the data shows a reason to."""
    return max(
        candidates(base),
        key=lambda s: (*evaluate(records, s)[:2], -distance(s, base)),
    )


def show(title: str, records: list[dict], settings: Settings) -> None:
    accuracy, f1, confusion = evaluate(records, settings)
    print(f"\n{title}: accuracy {accuracy:.0%}, macro-F1 {f1:.2f} ({len(records)} claims)")
    print("   gold \\ predicted   " + "".join(f"{p:>14}" for p in LABELS))
    for gold in LABELS:
        print(f"   {gold:18}" + "".join(f"{confusion[(gold, p)]:>14}" for p in LABELS))


def describe(settings: Settings) -> str:
    keys = [k for k in GRID if k != "weights"] + list(WEIGHT_KEYS)
    return ", ".join(f"{k}={getattr(settings, k)}" for k in keys)


def write_config(settings: Settings, path: Path = DEFAULT_CONFIG_YAML) -> None:
    text = path.read_text()
    for key in [k for k in GRID if k != "weights"] + list(WEIGHT_KEYS):
        text = re.sub(
            rf"^({key}:\s*)[^\s#]+", rf"\g<1>{getattr(settings, key)}", text, flags=re.MULTILINE
        )
    path.write_text(text)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--write", action="store_true", help="write the best values to config.yaml")
    args = parser.parse_args()

    data = json.loads((HERE / "signals.json").read_text())
    records = data["claims"]
    current = Settings()
    print(f"Signals from {data['model']} + {data['nli_model']}, {len(records)} labelled claims")

    show("Current config.yaml", records, current)
    best = search(records, current)
    show("Best on all claims", records, best)
    print(f"   {describe(best)}")

    # Does it carry over? Tune on one document, test on the other.
    for train_doc, test_doc in (("chandrayaan", "jwst"), ("jwst", "chandrayaan")):
        train = [r for r in records if document(r) == train_doc]
        test = [r for r in records if document(r) == test_doc]
        tuned = search(train, current)
        acc_cur, f1_cur, _ = evaluate(test, current)
        acc_tuned, f1_tuned, _ = evaluate(test, tuned)
        print(
            f"\nTuned on {train_doc}, tested on {test_doc}: "
            f"macro-F1 {f1_cur:.2f} -> {f1_tuned:.2f}, accuracy {acc_cur:.0%} -> {acc_tuned:.0%}"
        )

    print("\nClaims the best settings still get wrong:")
    for r in records:
        predicted = predict(r, best)
        if predicted != r["label"]:
            print(
                f"   gold {r['label']:12} got {predicted:12} E={r['entailment']:.2f} "
                f"C={r['contradiction']:.2f} cons={r['consistency']:.2f} judge={r['judge']}  "
                f"{r['claim']}"
            )

    if args.write:
        write_config(best)
        print(f"\nWrote the best values to {DEFAULT_CONFIG_YAML.name}")


if __name__ == "__main__":
    main()
