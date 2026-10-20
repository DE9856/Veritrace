"""Natural language inference with DeBERTa: does a source passage entail a claim?

The model is separate from the answer generator, so the check is independent of it.
"""

from dataclasses import dataclass

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


@dataclass(frozen=True)
class NLIScores:
    entailment: float
    neutral: float
    contradiction: float


class NLIModel:
    def __init__(self, model_name: str, device: str = "cpu", batch_size: int = 16):
        self.model_name = model_name
        self.device = device
        self.batch_size = batch_size
        self._tokenizer = AutoTokenizer.from_pretrained(model_name)
        # Transformers 5 keeps the checkpoint's float16 weights by default, and float16
        # matmuls on a CPU are ~10x slower than float32. Force float32 there.
        dtype = torch.float32 if device == "cpu" else "auto"
        self._model = AutoModelForSequenceClassification.from_pretrained(model_name, dtype=dtype)
        self._model.to(device).eval()
        # Label order differs between NLI checkpoints, so read it from the config.
        by_name = {name.lower(): i for i, name in self._model.config.id2label.items()}
        self._idx = (by_name["entailment"], by_name["neutral"], by_name["contradiction"])

    def predict(self, pairs: list[tuple[str, str]]) -> list[NLIScores]:
        """Score (premise, hypothesis) pairs. Long premises are truncated, never the claim."""
        results: list[NLIScores] = []
        e, n, c = self._idx
        for start in range(0, len(pairs), self.batch_size):
            batch = pairs[start : start + self.batch_size]
            encoded = self._tokenizer(
                [premise for premise, _ in batch],
                [hypothesis for _, hypothesis in batch],
                truncation="only_first",
                max_length=512,
                padding=True,
                return_tensors="pt",
            ).to(self.device)
            with torch.inference_mode():
                probs = torch.softmax(self._model(**encoded).logits, dim=-1).tolist()
            results.extend(NLIScores(p[e], p[n], p[c]) for p in probs)
        return results
