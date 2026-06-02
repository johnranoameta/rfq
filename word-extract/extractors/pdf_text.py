"""Extract text from PDF files."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def extract_pdf(pdf_path: Path) -> dict[str, Any]:
    """Return page-level and full text from a PDF."""
    import fitz  # PyMuPDF

    pdf_path = pdf_path.resolve()
    result: dict[str, Any] = {
        "source": str(pdf_path),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "engine": "pymupdf",
        "pages": [],
        "page_count": 0,
        "full_text": "",
    }

    with fitz.open(str(pdf_path)) as doc:
        result["page_count"] = doc.page_count
        result["metadata"] = {k: v for k, v in (doc.metadata or {}).items() if v}

        parts: list[str] = []
        for i, page in enumerate(doc, start=1):
            text = page.get_text("text").strip()
            parts.append(text)
            result["pages"].append({"page": i, "text": text, "char_count": len(text)})

        result["full_text"] = "\n\n".join(parts)

    return result
