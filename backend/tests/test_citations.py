from app.agent.nodes.generate import extract_citations, generate
from app.schemas import SourceChunk


def test_extracts_single_and_grouped_citations_in_order():
    answer = "Landed in 2023 [S2]. Found sulphur [S1][S3]. Both facts [S2, S4]."
    cited, invalid = extract_citations(answer, {"S1", "S2", "S3", "S4"})
    assert cited == ["S2", "S1", "S3", "S4"]
    assert invalid == []


def test_flags_labels_that_were_never_provided():
    cited, invalid = extract_citations("Claim [S1]. Made up [S9].", {"S1", "S2"})
    assert cited == ["S1"]
    assert invalid == ["S9"]


def test_no_citations():
    assert extract_citations("The provided documents don't contain this.", {"S1"}) == ([], [])


def test_strips_reasoning_with_or_without_opening_tag():
    from app.providers.ollama import _THINK_BLOCK

    assert _THINK_BLOCK.sub("", "<think>plan</think>\n\nAnswer [S1].").strip() == "Answer [S1]."
    assert _THINK_BLOCK.sub("", "plan... </think>\n\nAnswer [S1].").strip() == "Answer [S1]."
    assert _THINK_BLOCK.sub("", "Answer [S1].") == "Answer [S1]."


class SplitStream:
    """Streams a padded citation split across pieces, as gpt-oss on Groq does."""

    async def stream(self, prompt, *, system=None):
        for piece in ["Below 7 kelvin ", "[ S", "1 ]", " {HIGH}."]:
            yield piece


async def test_padded_citation_split_across_stream_pieces_is_recognised():
    source = SourceChunk(
        label="S1",
        chunk_id="doc_p1_c0",
        document_id="doc",
        filename="f.md",
        title="Doc",
        page=1,
        text="x.",
        similarity=0.8,
    )
    drafts = []
    result = await generate("q", [source], provider=SplitStream(), on_draft=drafts.append)
    assert result.answer == "Below 7 kelvin [S1]."
    assert result.cited_labels == ["S1"]
    assert drafts[-1] == "Below 7 kelvin [S1]."
