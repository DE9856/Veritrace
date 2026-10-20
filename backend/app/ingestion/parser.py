"""Extracts clean text from uploaded files, one entry per page."""

import re
from dataclasses import dataclass
from pathlib import Path

import pymupdf

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md"}


@dataclass
class Page:
    number: int  # 1-based, as a reader would cite it
    text: str


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


def parse_file(path: Path) -> list[Page]:
    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        allowed = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise UnsupportedFileError(f"Unsupported file type {ext!r}. Upload one of: {allowed}")
    if ext == ".pdf":
        with pymupdf.open(path) as doc:
            pages = [Page(i, clean_text(page.get_text("text"))) for i, page in enumerate(doc, 1)]
    else:
        # Plain text has no pages; treat the whole file as page 1.
        pages = [Page(1, clean_text(path.read_text(encoding="utf-8", errors="replace")))]
    return [p for p in pages if p.text]
