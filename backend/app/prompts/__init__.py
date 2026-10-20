"""Prompt templates live as .md files next to this module. Placeholders use {{name}}."""

from functools import lru_cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent


@lru_cache
def _load(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def render(name: str, **values: str) -> str:
    text = _load(name)
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text
