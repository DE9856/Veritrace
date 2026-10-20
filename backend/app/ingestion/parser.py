"""Extracts clean text from uploaded files, one entry per page, plus a document title."""

import re
from dataclasses import dataclass
from pathlib import Path

import pymupdf

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md"}
MAX_TITLE_CHARS = 100


@dataclass
class Page:
    number: int  # 1-based, as a reader would cite it
    text: str


@dataclass
class ParsedDocument:
    title: str
    pages: list[Page]


class UnsupportedFileError(ValueError):
    pass


def clean_text(text: str) -> str:
    """Undo PDF line wrapping while keeping paragraph breaks."""
    text = text.replace("\r\n", "\n").replace("­", "")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # re-join hyphenated line breaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)  # blank lines mark paragraphs
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)  # single newlines are just wrapping
    return text.strip()


def first_line_title(raw_text: str) -> str | None:
    """The first non-empty line, if it looks like a heading: short and not ending like
    a sentence."""
    for line in raw_text.splitlines():
        line = line.strip().lstrip("#").strip()
        if line:
            is_heading = len(line) <= MAX_TITLE_CHARS and not line.endswith(
                (".", "!", "?", ",", ";", ":")
            )
            return line if is_heading else None
    return None


def title_from_filename(filename: str) -> str:
    return Path(filename).stem.replace("_", " ").strip() or "Untitled"


def parse_file(path: Path, filename: str | None = None) -> ParsedDocument:
    """Parse a file. The title comes from PDF metadata, else the first short line,
    else the filename. It is prefixed to evidence during verification, because
    passages often refer to the subject only indirectly ("the lander")."""
    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        allowed = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise UnsupportedFileError(f"Unsupported file type {ext!r}. Upload one of: {allowed}")

    title: str | None = None
    if ext == ".pdf":
        with pymupdf.open(path) as doc:
            raw_pages = [page.get_text("text") for page in doc]
            meta_title = (doc.metadata or {}).get("title", "").strip()
        if 3 <= len(meta_title) <= MAX_TITLE_CHARS:
            title = meta_title
        elif raw_pages:
            title = first_line_title(raw_pages[0])
    else:
        # Plain text has no pages; treat the whole file as page 1.
        raw_pages = [path.read_text(encoding="utf-8", errors="replace")]
        title = first_line_title(raw_pages[0])
        if ext == ".md":
            # Heading markers are formatting, not content: "## Landing" -> "Landing".
            raw_pages = [re.sub(r"^\s{0,3}#{1,6}\s+", "", raw_pages[0], flags=re.MULTILINE)]

    pages = [Page(i, clean_text(raw)) for i, raw in enumerate(raw_pages, 1)]
    return ParsedDocument(
        title=title or title_from_filename(filename or path.name),
        pages=[p for p in pages if p.text],
    )
