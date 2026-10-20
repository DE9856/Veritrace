"""Verify node: checks every claim against the retrieved sources with NLI.

Whole chunks are long premises, which make NLI slower and less accurate. Each source is
split into short sentence windows, the windows closest to a claim are picked by a mix of
embedding similarity and word overlap, and NLI runs only on those pairs.
"""

import asyncio
import re
from dataclasses import dataclass

from app.agent.nodes.extract import AnswerSentence, ExtractedClaim
from app.ingestion.chunker import split_sentences
from app.ingestion.embedder import Embedder
from app.schemas import SourceChunk
from app.verification.nli import NLIModel, NLIScores
from app.verification.novelty import novelty
from app.verification.scoring import ClaimEvidence


@dataclass
class Window:
    source: SourceChunk
    text: str

    @property
    def titled(self) -> str:
        return f"{self.source.title}. {self.text}"


def combine_readings(titled: NLIScores, plain: NLIScores) -> NLIScores:
    """Each window is read twice: with the document title in front and without.

    The title lets NLI connect "Chandrayaan-3" to a passage that only says "the Vikram
    lander", but it can also blur a sentence that is clear on its own. Support counts if
    either reading shows it; a contradiction counts only if both readings agree, which
    filters out passages about a different event that NLI misreads as conflicting."""
    best = titled if titled.entailment >= plain.entailment else plain
    return NLIScores(
        entailment=best.entailment,
        neutral=best.neutral,
        contradiction=min(titled.contradiction, plain.contradiction),
    )


def build_windows(sources: list[SourceChunk], size: int) -> list[Window]:
    windows: list[Window] = []
    for source in sources:
        sentences = split_sentences(source.text)
        if len(sentences) <= size:
            windows.append(Window(source, " ".join(sentences)))
            continue
        for start in range(len(sentences) - size + 1):
            windows.append(Window(source, " ".join(sentences[start : start + size])))
    return windows


_STOPWORD_TEXT = (
    "a an the of in on at to for from by with and or but is are was were be been it its "
    "this that these those as into about also than then their there which who"
)
_STOPWORDS = frozenset(_STOPWORD_TEXT.split())
EMBEDDING_WEIGHT = 0.7  # the rest of the ranking score is word overlap
# A titled reading at least this entailed, with little contradiction, needs no second read.
DECISIVE_ENTAILMENT = 0.85
RECHECK_CONTRADICTION = 0.5


def content_words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in _STOPWORDS}


def cosine_matrix(a: list[list[float]], b: list[list[float]]) -> list[list[float]]:
    """Pairwise cosine similarity of normalised vectors."""
    return [[sum(x * y for x, y in zip(u, v, strict=True)) for v in b] for u in a]


def select_windows(
    similarities: list[list[float]],
    windows: list[Window],
    claims: list[ExtractedClaim],
    sentences: list[AnswerSentence],
    per_claim: int,
) -> list[list[int]]:
    """For each claim, the indices of its best-matching windows plus the best window of
    each source its sentence cited, so a cited source is always checked.

    Embeddings capture the topic but treat dates and numbers loosely, so the ranking
    also rewards windows that share the claim's words ("23", "August", "2023")."""
    citations = {s.index: set(s.citations) for s in sentences}
    window_words = [content_words(w.text) for w in windows]
    selected: list[list[int]] = []
    for claim, sims in zip(claims, similarities, strict=True):
        words = content_words(claim.text)
        rank_score = [
            EMBEDDING_WEIGHT * sim + (1 - EMBEDDING_WEIGHT) * len(words & ww) / max(len(words), 1)
            for sim, ww in zip(sims, window_words, strict=True)
        ]
        ranked = sorted(range(len(windows)), key=lambda i: rank_score[i], reverse=True)
        chosen = ranked[:per_claim]
        for label in citations.get(claim.sentence_index, set()):
            best = next((i for i in ranked if windows[i].source.label == label), None)
            if best is not None and best not in chosen:
                chosen.append(best)
        selected.append(chosen)
    return selected


def _verify_sync(
    claims: list[ExtractedClaim],
    sentences: list[AnswerSentence],
    sources: list[SourceChunk],
    embedder: Embedder,
    nli: NLIModel,
    window_size: int,
    per_claim: int,
) -> list[ClaimEvidence]:
    windows = build_windows(sources, window_size)
    if not claims or not windows:
        return []
    similarities = cosine_matrix(
        embedder.embed_queries([c.text for c in claims]),
        embedder.embed_documents([w.text for w in windows]),
    )
    selected = select_windows(similarities, windows, claims, sentences, per_claim)

    pairs = [(c, w) for c, ws in enumerate(selected) for w in ws]
    scores = nli.predict([(windows[w].titled, claims[c].text) for c, w in pairs])
    # Read again without the title only where the first reading is not decisive.
    recheck = [
        i
        for i, s in enumerate(scores)
        if s.entailment < DECISIVE_ENTAILMENT or s.contradiction >= RECHECK_CONTRADICTION
    ]
    plain = nli.predict([(windows[pairs[i][1]].text, claims[pairs[i][0]].text) for i in recheck])
    for i, reading in zip(recheck, plain, strict=True):
        scores[i] = combine_readings(scores[i], reading)
    scores = iter(scores)

    citations = {s.index: s.citations for s in sentences}
    evidence: list[ClaimEvidence] = []
    for c, (claim, window_ids) in enumerate(zip(claims, selected, strict=True)):
        results: list[tuple[NLIScores, int]] = [(next(scores), w) for w in window_ids]
        support, support_window = max(results, key=lambda r: r[0].entailment)
        contra, contra_window = max(results, key=lambda r: r[0].contradiction)
        new = novelty(claim.text, windows[support_window].titled)
        evidence.append(
            ClaimEvidence(
                sentence_index=claim.sentence_index,
                text=claim.text,
                sentence_citations=citations.get(claim.sentence_index, []),
                support=support,
                support_source=windows[support_window].source,
                support_similarity=similarities[c][support_window],
                max_contradiction=contra.contradiction,
                contradiction_source=windows[contra_window].source,
                new_words=new.new_words,
                new_numbers=new.new_numbers,
                novelty_share=new.share,
            )
        )
    return evidence


async def verify(
    claims: list[ExtractedClaim],
    sentences: list[AnswerSentence],
    sources: list[SourceChunk],
    *,
    embedder: Embedder,
    nli: NLIModel,
    window_size: int,
    per_claim: int,
) -> list[ClaimEvidence]:
    # Embedding and NLI are CPU-bound; keep them off the event loop.
    return await asyncio.to_thread(
        _verify_sync, claims, sentences, sources, embedder, nli, window_size, per_claim
    )
