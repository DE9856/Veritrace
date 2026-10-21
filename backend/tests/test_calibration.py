from app.config import Settings
from calibration.tune import evaluate, predict, write_config

SETTINGS = Settings(_env_file=None)


def record(label: str, entail: float, contra: float = 0.0, judge: str | None = None) -> dict:
    return {
        "question": "q",
        "claim": "A claim.",
        "label": label,
        "entailment": entail,
        "neutral": max(0.0, 1 - entail - contra),
        "contradiction": contra,
        "support_similarity": 0.8,
        "new_words": [],
        "new_numbers": [],
        "novelty_share": 0.0,
        "consistency": 1.0,
        "judge": judge,
        "judge_reason": "scripted" if judge else None,
    }


def test_judge_verdict_applies_only_where_the_claim_would_be_judged():
    # Clearly stated: never sent to the judge, so a stray verdict is ignored.
    assert predict(record("high", 0.99, judge="contradicted"), SETTINGS) == "high"
    # Unsupported by NLI: the judge's "derivable" counts.
    assert predict(record("inferred", 0.1, judge="derivable"), SETTINGS) == "inferred"


def test_evaluate_reports_accuracy_and_confusion():
    records = [record("high", 0.99), record("hallucinated", 0.0, 0.95), record("inferred", 0.0)]
    accuracy, _, confusion = evaluate(records, SETTINGS)
    assert accuracy == 2 / 3
    assert confusion[("inferred", "hallucinated")] == 1


def test_write_config_keeps_comments(tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text("# Labels\nhigh_threshold: 0.75   # keep me\nweight_entailment: 0.5\n")
    write_config(SETTINGS.model_copy(update={"high_threshold": 0.8}), path)
    assert path.read_text() == (
        "# Labels\nhigh_threshold: 0.8   # keep me\n"
        f"weight_entailment: {SETTINGS.weight_entailment}\n"
    )


def test_ablation_switches_signals_off():
    # Stated by NLI but with many new words: novelty makes it inferred, unless switched off.
    novel = {**record("high", 0.99), "novelty_share": 0.6, "new_words": ["x", "y"]}
    assert predict(novel, SETTINGS) == "inferred"
    assert predict(novel, SETTINGS, frozenset({"judge", "consistency"})) == "high"
    # Unsupported by NLI, but the judge finds it derivable: without the judge it is flagged.
    derivable = record("inferred", 0.1, judge="derivable")
    assert predict(derivable, SETTINGS, frozenset()) == "hallucinated"


def test_hallucination_metrics_treat_the_other_labels_as_one_class():
    from calibration.evaluate import metrics

    records = [record("hallucinated", 0.0), record("hallucinated", 0.99), record("high", 0.0)]
    m = metrics(records, lambda r: predict(r, SETTINGS))
    assert (m["hal_precision"], m["hal_recall"]) == (0.5, 0.5)


def test_novelty_is_recomputed_from_the_saved_passage():
    from calibration.evaluate import with_current_novelty

    saved = {**record("high", 0.99), "claim": "The rover drove 100 metres."}
    fresh = with_current_novelty({**saved, "support_passage": "The rover drove 100 metres."})
    assert fresh["novelty_share"] == 0.0 and fresh["new_numbers"] == []
    assert with_current_novelty(saved) is saved  # no passage saved: keep what was collected
