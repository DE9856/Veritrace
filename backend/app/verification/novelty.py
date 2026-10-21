"""Novelty: which words of a claim are missing from the passage that supports it.

NLI entails deductions as readily as statements: "reached lunar orbit about three weeks
after launch" scores 0.98 against a passage that only gives the two dates. A passage
that states a claim uses the claim's words, while a deduction introduces new ones
("three weeks"). A claim with a new quantity, or a large share of new words, is therefore
inferred rather than stated.

Quantities are what deductions add: numbers, durations ("a month" after two dates),
and comparisons ("only", "more than", "the coldest"). Other new words are often just a
paraphrase ("lifted off" for "launched"), so only a large share of them counts. Words
that rephrase without adding a fact (hedges, verb particles, "lunar" for "Moon") are
ignored.
"""

import re
from dataclasses import dataclass

_STOPWORDS = frozenset(
    (
        "a an the of in on at to for from by with and or but is are was were be been being "
        "it its this that these those as into about also than then their there which who "
        "has have had do does did not no its it's "
        # Connective words a rephrasing adds without adding a fact ("using its LIBS ...").
        "using use used via through also then both each while after before during "
        # Modals, causal links and pronouns: "MIRI must be colder ... because" restates
        # "MIRI has to be colder ..., so"; the facts are in the other words.
        "must can could may might should would will shall because so since therefore thus "
        "he she they them his her him we our you "
        # Hedges and verb particles: "roughly" restates "about", "lifted off" and
        # "opened out" add their particle to a verb.
        "roughly approximately around nearly almost some off out up"
    ).split()
)
_NUMBER_WORDS = frozenset(
    (
        "one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
        "fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy "
        "eighty ninety hundred thousand million billion dozen half twice"
    ).split()
)
# Words that turn stated facts into a computed or compared one.
_QUANTITY_WORDS = frozenset(
    (
        "day days week weeks fortnight month months year years decade decades hour hours "
        "minute minutes only more less fewer most least than"
    ).split()
)
# Superlatives ("coldest") compare what a passage states one by one. Words that merely end
# in "est" are left out.
_NOT_SUPERLATIVE = frozenset(
    "west test rest interest forest request harvest contest suggest protest honest modest "
    "earnest arrest invest digest manifest".split()
)
# The adjective and the noun for the same body: "lunar orbit" is an orbit around the Moon.
_SAME_THING = {"lunar": "moon", "solar": "sun"}


@dataclass(frozen=True)
class Novelty:
    new_words: list[str]  # claim words (stemmed) that the passage does not contain
    # Quantities the passage does not contain: numbers (as digits or words), durations,
    # comparisons and superlatives.
    new_numbers: list[str]
    share: float  # new words as a share of the claim's content words


def stem(word: str) -> str:
    """Crude suffix stripping, applied to claim and passage alike so "launched" and
    "launch", "landing" and "land", "achieved" and "achieve" match."""
    word = word.lower().removesuffix("'s").removesuffix("’s")
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    for suffix in ("ly", "ing", "ed", "es", "s"):
        if len(word) - len(suffix) >= 3 and word.endswith(suffix):
            word = word[: -len(suffix)]
            break
    # "achieve" and "achiev(ed)" should meet: drop a final silent e.
    word = word[:-1] if len(word) > 4 and word.endswith("e") else word
    return _SAME_THING.get(word, word)


def _terms(text: str) -> list[str]:
    # Drop possessives first, or "JWST's" leaves a stray "s" that counts as a new word.
    text = re.sub(r"['’]s\b", "", text.lower())
    # "One of its four instruments" picks one out of a list; it counts nothing.
    text = re.sub(r"\bone of\b", "of", text)
    return [w for w in re.findall(r"[a-z0-9]+", text) if w not in _STOPWORDS]


def is_quantity(word: str) -> bool:
    if word.isdigit() or word in _NUMBER_WORDS or word in _QUANTITY_WORDS:
        return True
    return len(word) > 5 and word.endswith("est") and word not in _NOT_SUPERLATIVE


def acronyms(text: str) -> set[str]:
    """Initials of each run of capitalised words, so a claim may say "JWST" about a
    passage titled "James Webb Space Telescope"."""
    runs = re.findall(r"[A-Z][a-z]+(?: [A-Z][a-z]+)+", text)
    return {"".join(word[0] for word in run.split()).lower() for run in runs}


def novelty(claim: str, passage: str) -> Novelty:
    claim_terms = _terms(claim)
    known = {stem(w) for w in _terms(passage)} | acronyms(passage)
    new = [w for w in dict.fromkeys(claim_terms) if stem(w) not in known]
    numbers = [w for w in new if is_quantity(w)]
    share = len(new) / len(set(claim_terms)) if claim_terms else 0.0
    return Novelty(new_words=new, new_numbers=numbers, share=share)
