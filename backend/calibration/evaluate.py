"""Evaluate the confidence labels on held-out claims, with an ablation of the signals.

Data, per model (<provider>_<split>_signals.json and <provider>_answers.json, from
collect_signals.py and collect_answers.py):
    dev    hand-written dev claims + claims from real answers to the "dev" questions
    test   hand-written test claims + claims from real answers to the "test" questions
    fresh  a second held-out set, added in 0.9.0 after test had been used to find the
           novelty rule's errors: hand-written claims + answers to questions that tempt
           the model to fill gaps in the documents
The thresholds and weights are tuned on dev only; every number reported for test and
fresh comes from claims the tuning never saw. Each model whose files exist gets its own
section.

Novelty is recomputed from the saved passages with the current code, so a change to
app/verification/novelty.py can be evaluated without collecting the signals again.

Run from backend/:
    python -m calibration.evaluate              # print the report
    python -m calibration.evaluate --write      # also write docs/evaluation.md
"""

import argparse
import json
from collections import Counter
from pathlib import Path

import yaml

from app.config import BACKEND_DIR, Settings
from app.verification.novelty import novelty
from calibration import reliability as rel
from calibration.tune import ALL_SIGNALS, LABELS, predict, score_record, search

HERE = Path(__file__).parent
REPORT = BACKEND_DIR.parent / "docs" / "evaluation.md"
FIGURES: dict[str, str] = {}  # docs/figures/<name>: SVG, written with the report
SELECTIVE_THRESHOLDS = (0.5, 0.7, 0.9, 0.95)
PROVIDERS = ("groq", "ollama")

# Ablation: which signals each row lets score_claim use. NLI is always on.
ABLATION = [
    ("NLI only", frozenset()),
    ("NLI + novelty", frozenset({"novelty"})),
    ("NLI + novelty + judge", frozenset({"novelty", "judge"})),
    ("NLI + novelty + judge + consistency", frozenset({"novelty", "judge", "consistency"})),
    ("Full ensemble (+ self-label)", ALL_SIGNALS),
    ("Full minus judge", ALL_SIGNALS - {"judge"}),
    ("Full minus consistency", ALL_SIGNALS - {"consistency"}),
    ("Full minus novelty", ALL_SIGNALS - {"novelty"}),
]


# ------------------------------------------------------------------ data


def load(name: str) -> dict:
    return json.loads((HERE / name).read_text())


def with_current_novelty(record: dict) -> dict:
    if not record.get("support_passage"):
        return record
    new = novelty(record["claim"], record["support_passage"])
    return {
        **record,
        "new_words": new.new_words,
        "new_numbers": new.new_numbers,
        "novelty_share": new.share,
    }


def answer_claims(provider: str, split: str) -> tuple[list[dict], list[str]]:
    """Labelled claims from real answers in one split, and the claims still unlabelled."""
    path = HERE / f"{provider}_answers.json"
    if not path.exists():
        return [], []
    labels = yaml.safe_load((HERE / "answer_labels.yaml").read_text())["labels"] or {}
    claims = [c for c in load(path.name)["claims"] if c["split"] == split]
    labelled = [{**c, "label": labels[c["claim"]]} for c in claims if c["claim"] in labels]
    missing = [c["claim"] for c in claims if c["claim"] not in labels]
    return labelled, missing


def dataset(provider: str, split: str) -> tuple[list[dict], list[str]]:
    written = load(f"{provider}_{split}_signals.json")["claims"]
    from_answers, missing = answer_claims(provider, split)
    for r in written:
        r["origin"] = "hand-written"
    for r in from_answers:
        r["origin"] = "from answers"
    return [with_current_novelty(r) for r in written + from_answers], missing


# ------------------------------------------------------------------ metrics


def hallucination_scores(confusion: Counter) -> tuple[float, float, float]:
    """Precision, recall and F1 of the hallucinated label against the other two."""
    tp = confusion[("hallucinated", "hallucinated")]
    predicted = sum(confusion[(g, "hallucinated")] for g in LABELS)
    actual = sum(confusion[("hallucinated", p)] for p in LABELS)
    precision = tp / predicted if predicted else 0.0
    recall = tp / actual if actual else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def metrics(records: list[dict], label_of) -> dict:
    confusion: Counter = Counter((r["label"], label_of(r)) for r in records)
    accuracy = sum(confusion[(lab, lab)] for lab in LABELS) / len(records)
    f1s = []
    for lab in LABELS:
        tp = confusion[(lab, lab)]
        predicted = sum(confusion[(g, lab)] for g in LABELS)
        actual = sum(confusion[(lab, p)] for p in LABELS)
        p = tp / predicted if predicted else 0.0
        r = tp / actual if actual else 0.0
        f1s.append(2 * p * r / (p + r) if p + r else 0.0)
    precision, recall, f1 = hallucination_scores(confusion)
    return {
        "accuracy": accuracy,
        "macro_f1": sum(f1s) / len(f1s),
        "hal_precision": precision,
        "hal_recall": recall,
        "hal_f1": f1,
        "confusion": confusion,
    }


def judge_only(record: dict) -> str:
    """LLM-as-judge baseline: the judge's verdict alone, for every claim."""
    return "high" if record["judge"] in ("stated", "derivable") else "hallucinated"


def consistency_only(record: dict) -> str:
    """SelfCheckGPT-style baseline: how often resampled answers state the claim."""
    cons = record["consistency"] or 0.0
    return "high" if cons >= 0.67 else "inferred" if cons >= 0.34 else "hallucinated"


# ------------------------------------------------------------------ report


def row(name: str, m: dict) -> str:
    return (
        f"| {name} | {m['accuracy']:.0%} | {m['macro_f1']:.2f} | {m['hal_precision']:.2f} | "
        f"{m['hal_recall']:.2f} | {m['hal_f1']:.2f} |"
    )


TABLE_HEAD = (
    "| Setting | Accuracy | Macro-F1 | Hallucination precision | Hallucination recall "
    "| Hallucination F1 |\n|---|---|---|---|---|---|"
)


def confusion_table(confusion: Counter) -> str:
    lines = ["| Gold \\ predicted | " + " | ".join(LABELS) + " |", "|---|---|---|---|"]
    for gold in LABELS:
        lines.append(f"| {gold} | " + " | ".join(str(confusion[(gold, p)]) for p in LABELS) + " |")
    return "\n".join(lines)


def counts(records: list[dict]) -> str:
    c = Counter(r["label"] for r in records)
    return ", ".join(f"{c[lab]} {lab}" for lab in LABELS)


def available() -> list[str]:
    return [
        p
        for p in PROVIDERS
        if (HERE / f"{p}_dev_signals.json").exists() and (HERE / f"{p}_test_signals.json").exists()
    ]


def model_section(provider: str) -> list[str]:
    dev, dev_missing = dataset(provider, "dev")
    test, test_missing = dataset(provider, "test")
    fresh, fresh_missing = (
        dataset(provider, "fresh")
        if (HERE / f"{provider}_fresh_signals.json").exists()
        else ([], [])
    )
    meta = load(f"{provider}_dev_signals.json")
    current = Settings()
    tuned = search(dev, current)

    def ours(settings, signals=ALL_SIGNALS):
        return lambda r: predict(r, settings, signals)

    out: list[str] = []
    w = out.append
    w(f"## `{meta['model']}`\n")
    w(
        f"Answers, judge and {meta['consistency_samples']} resampled answers per question from "
        f"`{meta['model']}`; NLI from `{meta['nli_model']}`.\n"
    )
    for split, records in (("Dev", dev), ("Test", test), ("Fresh", fresh)):
        if not records:
            continue
        origins = Counter(r["origin"] for r in records)
        w(
            f"- **{split}:** {len(records)} claims ({counts(records)}): "
            f"{origins['hand-written']} hand-written, {origins['from answers']} from real answers."
        )
    w("")

    for name, records in (("test", test), ("fresh", fresh)):
        if not records:
            continue
        w(f"### Main result ({name})\n")
        if name == "fresh":
            w(
                "The cleaner measure since 0.9.0: the claims were written before the novelty "
                "and judge changes, and no rule or setting was tuned on them. Their errors "
                "under a first, word-list-only attempt were seen once; that attempt did not "
                "help here and was replaced by the judge's stated verdict.\n"
            )
        w(TABLE_HEAD)
        w(row("Current `config.yaml`", metrics(records, ours(current))))
        w(row("Tuned on dev", metrics(records, ours(tuned))))
        w("")
        w(f"Confusion matrix on {name}, current settings:\n")
        w(confusion_table(metrics(records, ours(current))["confusion"]))
        w("")
        for origin in ("hand-written", "from answers"):
            part = [r for r in records if r["origin"] == origin]
            if part:
                m = metrics(part, ours(current))
                w(
                    f"- {origin.capitalize()} claims ({len(part)}): accuracy "
                    f"{m['accuracy']:.0%}, macro-F1 {m['macro_f1']:.2f}, hallucination F1 "
                    f"{m['hal_f1']:.2f}."
                )
        w("")

    out.extend(calibration_section(provider, dev, test, fresh, current))
    out.extend(synthetic_section(provider, current))

    w("### Ablation (test, current settings)\n")
    w(
        "Each row lets the scorer use only some signals; NLI entailment, contradiction and "
        "passage match are always on. Missing weights are renormalised, as in the app.\n"
    )
    w(TABLE_HEAD)
    for name, signals in ABLATION:
        w(row(name, metrics(test, ours(current, signals))))
    w(row("Baseline: LLM judge alone", metrics(test, judge_only)))
    w(row("Baseline: self-consistency alone", metrics(test, consistency_only)))
    w("")
    w(
        "The two baselines can only answer supported or not, so they never say inferred, "
        "which caps their macro-F1.\n"
    )

    w("### Settings tuned on dev\n")
    changed = [k for k in TUNED_KEYS if getattr(current, k) != getattr(tuned, k)]
    if changed:
        w("| Setting | Current | Tuned on dev |\n|---|---|---|")
        for key in changed:
            w(f"| `{key}` | {getattr(current, key)} | {getattr(tuned, key)} |")
    else:
        w("The grid search keeps every current value.")
    w("")

    for name, records in (("Test", test), ("Fresh", fresh)):
        if not records:
            continue
        w(f"### {name} claims the current settings get wrong\n")
        wrong = [r for r in records if predict(r, current) != r["label"]]
        if wrong:
            w("| Claim | Gold | Predicted | Signals |\n|---|---|---|---|")
            for r in wrong:
                cons = "–" if r["consistency"] is None else f"{r['consistency']:.2f}"
                new = ", ".join(r["new_words"]) or "–"
                w(
                    f"| {r['claim']} | {r['label']} | {predict(r, current)} | "
                    f"E={r['entailment']:.2f} C={r['contradiction']:.2f} cons={cons} "
                    f"judge={r['judge']} new words: {new} |"
                )
        else:
            w("None.")
        w("")

    unlabelled = dev_missing + test_missing + fresh_missing
    if unlabelled:
        w(f"_{len(unlabelled)} claims from answers are not labelled yet and are left out._\n")
    return out


KIND_NAMES = {
    "date": "Wrong date",
    "number": "Wrong number",
    "count": "Wrong count or ordinal",
    "entity": "Swapped name",
    "negation": "Flipped negation",
    "original": "Unchanged (control)",
}


def synthetic_section(provider: str, current: Settings) -> list[str]:
    """Detection by kind of error, on true claims with one fact changed (synthetic.py)."""
    path = HERE / f"{provider}_synthetic_signals.json"
    if not path.exists():
        return []
    records = [with_current_novelty(r) for r in load(path.name)["claims"]]
    out: list[str] = []
    w = out.append
    w("### Synthetic hallucinations\n")
    w(
        "True claims with one fact changed by fixed rules (`calibration/synthetic.py`, no "
        "model): a date moved, a number or count changed, a name swapped for a confusable "
        "one from the documents, a negation flipped. Two sources: the documents' own "
        "sentences, and the hand-labelled high claims (paraphrases, as a model writes them). "
        "The unchanged claims are the controls. Consistency is off, since a synthetic claim "
        "has no question of its own to resample. Caught means labelled hallucinated.\n"
    )
    w(
        "| Source | Change | Claims | Caught | Labelled inferred | Labelled high "
        "| NLI alone caught | Judge alone caught |\n|---|---|---|---|---|---|---|---|"
    )
    groups: dict[tuple[str, str], list[dict]] = {}
    for r in records:
        groups.setdefault((r["source"], r["kind"]), []).append(r)
    order = list(KIND_NAMES)
    for source, kind in sorted(groups, key=lambda k: (k[0], order.index(k[1]))):
        group = groups[(source, kind)]
        labels = Counter(predict(r, current) for r in group)
        nli = sum(predict(r, current, frozenset()) == "hallucinated" for r in group)
        judged = sum(judge_only(r) == "hallucinated" for r in group)
        w(
            f"| {source.capitalize()} | {KIND_NAMES[kind]} | {len(group)} | "
            f"{labels['hallucinated']} | {labels['inferred']} | {labels['high']} | {nli} | "
            f"{judged} |"
        )
    corrupted = [r for r in records if r["kind"] != "original"]
    controls = [r for r in records if r["kind"] == "original"]
    caught = sum(predict(r, current) == "hallucinated" for r in corrupted)
    flagged = sum(predict(r, current) == "hallucinated" for r in controls)
    w("")
    w(
        f"Overall: {caught} of {len(corrupted)} corrupted claims caught "
        f"({caught / len(corrupted):.0%}); {flagged} of {len(controls)} unchanged claims "
        "wrongly flagged. For the unchanged claims, the caught columns count false alarms.\n"
    )
    missed = [r for r in corrupted if predict(r, current) != "hallucinated"]
    if missed:
        w("Corrupted claims it misses:\n")
        w("| Claim | Change | Predicted | Signals |\n|---|---|---|---|")
        for r in missed:
            w(
                f"| {r['claim']} | {KIND_NAMES[r['kind']].lower()} | {predict(r, current)} | "
                f"E={r['entailment']:.2f} C={r['contradiction']:.2f} judge={r['judge']} |"
            )
        w("")
    return out


def calibration_section(provider, dev, test, fresh, current) -> list[str]:
    """Is the score a probability? Fit Platt scaling on dev, check it on test and fresh,
    and show what hiding the least confident claims buys."""

    def points(records, calibrated: bool) -> list[tuple[float, bool]]:
        out = []
        for r in records:
            result = score_record(r, current)
            confidence = result.support_probability if calibrated else result.score
            out.append((confidence, r["label"] != "hallucinated"))
        return out

    slope, intercept = rel.fit_platt(points(dev, calibrated=False))
    out: list[str] = []
    w = out.append
    w("### Confidence calibration\n")
    w(
        "Is the score a probability? A claim counts as supported when its hand label is high "
        "or inferred. The score is mapped to a calibrated chance of support with Platt "
        "scaling, sigmoid(slope x score + intercept), fitted on dev "
        f"(`calibration/reliability.py`). Fitted now: slope {slope:.2f}, intercept "
        f"{intercept:.2f}; `config.yaml` has {current.support_slope:.2f} and "
        f"{current.support_intercept:.2f}. ECE is the gap between confidence and the share "
        f"supported, averaged over {rel.BINS} equal-width bins (lower is better), with a 95% "
        "bootstrap interval; Brier is the mean squared error of the confidence.\n"
    )
    w(
        "| Set | Claims | ECE, raw score | ECE, calibrated | Brier, raw | Brier, calibrated |\n"
        "|---|---|---|---|---|---|"
    )
    for name, records in (("Dev (fitted on)", dev), ("Test", test), ("Fresh", fresh)):
        if not records:
            continue
        raw, cal = points(records, False), points(records, True)
        (rl, rh), (cl, ch) = rel.ece_interval(raw), rel.ece_interval(cal)
        w(
            f"| {name} | {len(records)} | {rel.ece(raw):.3f} ({rl:.2f}-{rh:.2f}) | "
            f"{rel.ece(cal):.3f} ({cl:.2f}-{ch:.2f}) | {rel.brier(raw):.3f} | "
            f"{rel.brier(cal):.3f} |"
        )
    w("")

    held_out, held_name = (fresh, "fresh") if fresh else (test, "test")
    raw_bins = rel.bins(points(held_out, False))
    cal_bins = rel.bins(points(held_out, True))
    w(f"Reliability on {held_name}, by bin of the raw score and of the calibrated chance:\n")
    w(
        "| Bin | Raw: claims | Raw: mean score | Raw: supported | Calibrated: claims "
        "| Calibrated: mean | Calibrated: supported |\n|---|---|---|---|---|---|---|"
    )
    by_low = {round(b.low, 1): b for b in cal_bins}
    for low in sorted({round(b.low, 1) for b in raw_bins} | set(by_low)):
        r = next((b for b in raw_bins if round(b.low, 1) == low), None)
        c = by_low.get(low)
        cells = [
            f"{r.count} | {r.mean_confidence:.2f} | {r.supported:.0%}" if r else "– | – | –",
            f"{c.count} | {c.mean_confidence:.2f} | {c.supported:.0%}" if c else "– | – | –",
        ]
        w(f"| {low:.1f}-{low + 0.2:.1f} | {cells[0]} | {cells[1]} |")
    w("")
    figure = f"reliability_{provider}.svg"
    FIGURES[figure] = rel.reliability_svg(
        [("Raw score", raw_bins), ("Calibrated", cal_bins)],
        f"{held_name.capitalize()} set, {len(held_out)} claims; each point is a bin",
    )
    w(f"![Reliability diagram on {held_name}](figures/{figure})\n")

    w(f"### Selective answering ({held_name})\n")
    w(
        "Show only the claims whose calibrated chance of support is at least a threshold: "
        "fewer claims are shown, and fewer of them are wrong. The rest would be hidden or "
        "marked as unverified.\n"
    )
    w(
        "| Chance of support at least | Claims shown | Shown claims hallucinated "
        "| Hallucinations still shown | Supported claims hidden |\n|---|---|---|---|---|"
    )
    cal = points(held_out, True)
    cuts = [rel.selective(cal, t) for t in SELECTIVE_THRESHOLDS]
    w(f"| (show all) | 100% | {rel.selective(cal, 0.0).risk:.0%} | – | – |")
    for c in cuts:
        w(
            f"| {c.threshold:.0%} | {c.coverage:.0%} | {c.risk:.0%} | "
            f"{c.hallucinations_shown} of {c.hallucinations} | "
            f"{c.supported_hidden} of {c.supported} |"
        )
    w("")
    figure = f"coverage_{provider}.svg"
    FIGURES[figure] = rel.coverage_svg(
        rel.risk_coverage(cal), cuts, f"{held_name.capitalize()} set, {len(held_out)} claims"
    )
    w(f"![Risk-coverage curve on {held_name}](figures/{figure})\n")
    return out


TUNED_KEYS = (
    "high_threshold",
    "inferred_threshold",
    "contradiction_threshold",
    "strong_entailment",
    "novelty_threshold",
    "weight_entailment",
    "weight_consistency",
    "weight_retrieval",
    "weight_self_label",
)


def build_report() -> str:
    out: list[str] = []
    w = out.append
    w("# Evaluation\n")
    w(
        "How well Veritrace's three labels match hand labels, on claims the tuning never saw. "
        "Generated by `python -m calibration.evaluate --write`; see "
        "`backend/calibration/` for the data and code.\n"
    )
    w("## Setup\n")
    w(
        "- **Labels:** high (a passage states the claim), inferred (follows from the passages "
        "without outside knowledge), hallucinated (contradicted, or not supported). Judged by "
        "hand against the two sample documents only."
    )
    w(
        "- **Claims:** hand-written claims (`dev_claims.yaml`, `test_claims.yaml`, "
        "`fresh_claims.yaml`), plus every claim the agent extracted from its own answers to "
        "the questions in `answer_questions.yaml`, labelled in `answer_labels.yaml`."
    )
    w(
        "- **Protocol:** the scoring rules were designed and the settings tuned on dev only; "
        "test and fresh are only scored. In 0.9.0 the test set's errors were read to find "
        "what to fix, so test overstates that change; the fresh set, written before it, is "
        "the cleaner measure. The numbers below use the "
        "settings in `config.yaml`; the grid search on dev (`calibration/tune.py`) is shown "
        "for comparison.\n"
    )
    for provider in available():
        out.extend(model_section(provider))

    latency = sorted(HERE.glob("latency_*.json"))
    if latency:
        w("## Latency\n")
        w(
            "Seconds per question through the full agent (plan, search, answer, extract, "
            "verify, judge, consistency, score), on this laptop.\n"
        )
        w(
            "| Model | Questions | Median s | Min s | Max s | Median tokens |\n"
            "|---|---|---|---|---|---|"
        )
        for path in latency:
            data = load(path.name)
            secs = sorted(q["seconds"] for q in data["questions"])
            lo, hi = secs[0], secs[-1]
            median = secs[len(secs) // 2]
            tokens = sorted(q["tokens"] for q in data["questions"] if "tokens" in q)
            mid_tokens = f"{tokens[len(tokens) // 2]:,}" if tokens else "–"
            w(
                f"| `{data['model']}` | {len(secs)} | {median:.1f} | {lo:.1f} | {hi:.1f} "
                f"| {mid_tokens} |"
            )
        w("")
    return "\n".join(out)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--write", action="store_true", help=f"write {REPORT.name}")
    args = parser.parse_args()
    report = build_report()
    print(report)
    if args.write:
        REPORT.write_text(report + "\n")
        print(f"\nWrote {REPORT.relative_to(BACKEND_DIR.parent)}")
        figures = REPORT.parent / "figures"
        figures.mkdir(exist_ok=True)
        for name, svg in FIGURES.items():
            (figures / name).write_text(svg)
            print(f"Wrote {(figures / name).relative_to(BACKEND_DIR.parent)}")


if __name__ == "__main__":
    main()
