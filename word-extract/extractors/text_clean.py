"""Text cleaning utilities for RFQ normalization."""

from __future__ import annotations

import re

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MULTI_NEWLINE = re.compile(r"\n{3,}")
_MULTI_SPACE = re.compile(r"[ \t]{2,}")


def clean_text(text: str | None) -> str:
    """Normalize extracted text for embedding and comparison."""
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\x07", "")
    text = _CONTROL_CHARS.sub("", text)
    lines = [line.strip() for line in text.split("\n")]
    lines = [line for line in lines if line]
    text = "\n".join(lines)
    text = _MULTI_NEWLINE.sub("\n\n", text)
    return text.strip()


def paragraphs_to_text(paragraphs: list[dict]) -> str:
    parts = []
    for para in paragraphs:
        t = clean_text(para.get("text"))
        if t:
            parts.append(t)
    return "\n\n".join(parts)


def estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars per token for English prose)."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def chunk_text(
    text: str,
    *,
    max_chars: int = 1200,
    overlap: int = 200,
) -> list[str]:
    """Split text into overlapping chunks suitable for embedding."""
    text = clean_text(text)
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            # Prefer breaking at paragraph or sentence boundary
            window = text[start:end]
            for sep in ("\n\n", ". ", "\n"):
                idx = window.rfind(sep)
                if idx > max_chars // 2:
                    end = start + idx + len(sep)
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks
