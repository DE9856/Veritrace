"""Synthetic hallucinations: true sentences from the sample documents with one fact
changed, to measure detection by kind of error without labelling by hand.

Two sources of true claims: the sample documents' own sentences, and the hand-labelled
"high" claims of dev, test and fresh (paraphrases, as a model writes them). Each is kept
once as a stated claim (a control: the checker should not flag it) and corrupted once
per rule that applies:
    date      a date moved by a month, or a year moved by one
    number    a measurement or count changed ("100 metres" -> "300 metres")
    count     a number word or ordinal changed ("fourth" -> "third", "five-layer" -> "six-layer")
    entity    a name swapped for a confusable one from the documents (MIRI -> NIRCam,
              Sriharikota -> Kourou)
    negation  a negation flipped ("no orbiter" -> "an orbiter")
A corrupted sentence keeps every other fact, which makes it harder than an invented
one: most of it is still stated by the passage.

No model is used, so the set is reproducible. The output, synthetic_claims.yaml, is
written for review; every changed sentence was read once, and the few that came out
arguable or unclear are listed in _DROPPED.

Run from backend/:
    python -m calibration.synthetic                     # writes synthetic_claims.yaml
    CONSISTENCY_SAMPLES=0 python -m calibration.collect_signals \\
        --claims synthetic_claims.yaml --out ollama_synthetic_signals.json
Consistency is off: a synthetic claim has no question of its own to resample answers
for. Each claim is its own retrieval query (the sample documents are four passages, so
retrieval returns all of them anyway).
"""

import re
from pathlib import Path

import yaml

from app.config import BACKEND_DIR
from app.ingestion.chunker import split_sentences

HERE = Path(__file__).parent
SAMPLES = ["chandrayaan-3.md", "james-webb-space-telescope.md"]

MONTHS = (
    "January February March April May June July August September October November December"
).split()
_DATE = re.compile(rf"\b(\d{{1,2}} )?({'|'.join(MONTHS)}) (\d{{4}})\b")
_YEAR = re.compile(r"(?<![\w-])(19\d\d|20\d\d)(?![\w-])")
# A measurement or count: digits not glued to a name ("LVM3", "Chandrayaan-3", "L2",
# "Ariane 5", "SMACS 0723") and not part of a date.
_NUMBER = re.compile(
    r"(?<![\w.-])(\d+(?:\.\d+)?)"
    r"(?= (?:metres|centimetres|million|kelvin|Earth|hexagonal|days))"
)
_COUNT_WORDS = {
    "four": "three",
    "five": "six",
    "first": "second",
    "second": "third",
    "third": "fourth",
    "fourth": "third",
}
# Confusable names from the documents, in one direction each so a swap never undoes
# another. Hand-made; each swap gives a false sentence wherever the name occurs.
_SWAPS = {
    "Vikram lander": "Pragyan rover",
    "Pragyan rover": "Vikram lander",
    "propulsion module": "lander module",
    "south pole": "north pole",
    "Sriharikota": "Kourou",
    "Kourou": "Sriharikota",
    "LVM3": "Ariane 5",
    "Ariane 5": "LVM3",
    "MIRI": "NIRCam",
    "ChaSTE": "LIBS",
    "sulphur": "water ice",
    "beryllium": "aluminium",
    "infrared light": "ultraviolet light",
    "Shiv Shakti": "Vikram Sarabhai",
    "SMACS 0723": "Andromeda",
    "Chandrayaan-2": "Chandrayaan-1",
}
_NEGATIONS = [
    ("but no orbiter", "and an orbiter"),
    ("did not respond", "responded"),
    ("has to be colder than", "can be warmer than"),
]
# Changes dropped after reading the generated set: true in the real world, so the label
# would be arguable, or no longer a clear statement.
_DROPPED = {
    "It followed Chandrayaan-2, whose Pragyan rover crashed during its landing attempt in "
    "September 2019.",  # Chandrayaan-2 did carry a Pragyan rover
    "The rest of the second full-colour images were released on 12 July 2022.",
    # The rover was inside the lander, so in a sense it touched down too.
    "The Pragyan rover touched down near the lunar south pole on 23 August 2023.",
    "Chandrayaan-2's Pragyan rover crashed while trying to land in September 2019.",
    "Pragyan drove out of the Pragyan rover soon after touchdown.",
}


def sentences(name: str) -> list[str]:
    text = (BACKEND_DIR / "samples" / name).read_text()
    body = "\n\n".join(p for p in text.split("\n\n") if not p.lstrip().startswith("#"))
    return [s for s in split_sentences(body) if len(s.split()) >= 5]


def _shift_date(match: re.Match) -> str:
    day, month, year = match.group(1) or "", match.group(2), match.group(3)
    return f"{day}{MONTHS[(MONTHS.index(month) + 1) % 12]} {year}"


def corruptions(sentence: str) -> list[tuple[str, str]]:
    """(kind, changed sentence) for every rule that applies, first match of each."""
    out = []
    if _DATE.search(sentence):
        out.append(("date", _DATE.sub(_shift_date, sentence, count=1)))
    elif _YEAR.search(sentence):
        out.append(("date", _YEAR.sub(lambda m: str(int(m.group(1)) + 1), sentence, count=1)))
    if match := _NUMBER.search(sentence):
        value = match.group(1)
        changed = str(round(float(value) * 3, 1)).removesuffix(".0")
        out.append(("number", sentence[: match.start(1)] + changed + sentence[match.end(1) :]))
    for word, other in _COUNT_WORDS.items():
        if re.search(rf"\b{word}\b", sentence):
            out.append(("count", re.sub(rf"\b{word}\b", other, sentence, count=1)))
            break
    for name, other in _SWAPS.items():
        # A swap to a name the sentence already has gives nonsense ("separated from the
        # lander module" for "the lander module").
        if name in sentence and other not in sentence:
            out.append(("entity", sentence.replace(name, other, 1)))
            break
    for text, other in _NEGATIONS:
        if text in sentence:
            out.append(("negation", sentence.replace(text, other, 1)))
    return [(kind, s) for kind, s in out if s != sentence and s not in _DROPPED]


def paraphrases() -> list[tuple[str, str]]:
    """(question, claim) for every hand-labelled high claim: true claims in a model's own
    words, which are harder to check once corrupted than the documents' sentences."""
    out = []
    for name in ("dev_claims.yaml", "test_claims.yaml", "fresh_claims.yaml"):
        for item in yaml.safe_load((HERE / name).read_text())["claims"]:
            if item["label"] == "high":
                out.append((item["question"], item["claim"]))
    return out


def build() -> list[dict]:
    """Two sources: the documents' own sentences (each its own query), and the
    hand-labelled paraphrases (with their questions)."""
    bases = [("document", s, s) for name in SAMPLES for s in sentences(name)]
    bases += [("paraphrase", q, c) for q, c in paraphrases()]
    claims, seen = [], set()
    for source, question, sentence in bases:
        if sentence in seen:
            continue
        seen.add(sentence)
        claims.append(
            {
                "question": question,
                "claim": sentence,
                "label": "high",
                "kind": "original",
                "source": source,
            }
        )
        for kind, changed in corruptions(sentence):
            if changed in seen:  # the same corruption from both sources
                continue
            seen.add(changed)
            claims.append(
                {
                    "question": changed if source == "document" else question,
                    "claim": changed,
                    "label": "hallucinated",
                    "kind": kind,
                    "source": source,
                    "original": sentence,
                }
            )
    return claims


def main() -> None:
    claims = build()
    out = HERE / "synthetic_claims.yaml"
    header = (
        "# Generated by calibration/synthetic.py; do not edit by hand. Each sample sentence\n"
        "# and hand-labelled high claim (kind: original, label high), and one corruption\n"
        "# per rule that applies (label hallucinated).\n"
    )
    out.write_text(header + yaml.safe_dump({"claims": claims}, sort_keys=False, width=200))
    kinds: dict[str, int] = {}
    for c in claims:
        key = f"{c['source']} {c['kind']}"
        kinds[key] = kinds.get(key, 0) + 1
    print(f"Wrote {len(claims)} claims to {out.name}: {kinds}")


if __name__ == "__main__":
    main()
