"""Parse label/value fields from RFQ form text and Excel grids."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_LABEL_LINE = re.compile(r"^(.{1,120}?):\s*(.*)$")
_SKIP_FIELD = re.compile(r"^(https?://|www\.)", re.I)


def _norm(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r", "\n").replace("\x07", "")
    return " ".join(text.split()).strip()


def _dedupe_fields(fields: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for row in fields:
        key = row["field"].strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append({"field": row["field"], "value": row.get("value") or ""})
    return out


def parse_fields_from_text(text: str | None) -> list[dict[str, str]]:
    """Extract `Field: value` lines and tab-separated label pairs from prose."""
    if not text or not str(text).strip():
        return []

    fields: list[dict[str, str]] = []
    for raw_line in str(text).replace("\r", "\n").split("\n"):
        line = raw_line.strip()
        if not line or len(line) > 500:
            continue

        if "\t" in line and ":" not in line:
            parts = [p.strip() for p in line.split("\t") if p.strip()]
            if len(parts) == 2 and len(parts[0]) < 80:
                fields.append({"field": parts[0], "value": parts[1]})
            continue

        m = _LABEL_LINE.match(line)
        if not m:
            continue
        field = m.group(1).strip()
        value = m.group(2).strip()
        if not field or _SKIP_FIELD.match(field):
            continue
        if field.lower() in {"http", "https"}:
            continue
        fields.append({"field": field, "value": value})

    return _dedupe_fields(fields)


def parse_fields_from_excel(excel_data: dict[str, Any] | None, *, max_rows: int = 200) -> list[dict[str, str]]:
    """Heuristic: first column label, next non-empty cell is value."""
    if not excel_data:
        return []

    fields: list[dict[str, str]] = []
    for sheet in excel_data.get("sheets") or []:
        for row in (sheet.get("values") or [])[:max_rows]:
            cells = [_norm(c) for c in row]
            non_empty = [(i, c) for i, c in enumerate(cells) if c]
            if not non_empty:
                continue

            first_idx, first = non_empty[0]
            if first.endswith(":"):
                label = first.rstrip(":").strip()
                value = ""
                for i, c in non_empty[1:]:
                    if i > first_idx:
                        value = c
                        break
                if label:
                    fields.append({"field": label, "value": value})
                continue

            if len(non_empty) >= 2:
                label = first
                value = non_empty[1][1]
                if len(label) < 80 and not label.isdigit():
                    fields.append({"field": label, "value": value})

    return _dedupe_fields(fields)


def load_excel_fields(path: str | None) -> list[dict[str, str]]:
    if not path:
        return []
    p = Path(path)
    if not p.is_file():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []
    return parse_fields_from_excel(data)


def build_section_fields(
    *,
    section_number: str,
    section_display: str | None,
    status: str,
    body_text: str,
    expected_files: list[dict[str, Any]],
    attachments: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """
    One flat field/value list per section (blank value when unknown).
    Includes metadata rows plus parsed form fields from body, docs, and Excel.
    """
    rows: list[dict[str, str]] = [
        {"field": "section_number", "value": section_number},
        {"field": "section_title", "value": _norm(section_display)},
        {"field": "status", "value": _norm(status)},
    ]

    for ef in expected_files:
        label = ef.get("icon_label") or ef.get("filename") or "attachment"
        rows.append({"field": f"attachment · {label}", "value": "present" if ef.get("present") else ""})
        rows.append({"field": f"attachment · {label} · filename", "value": _norm(ef.get("filename"))})
        rows.append({"field": f"attachment · {label} · file_type", "value": _norm(ef.get("file_type"))})
        rows.append({"field": f"attachment · {label} · role", "value": _norm(ef.get("document_role"))})
        if ef.get("error"):
            rows.append({"field": f"attachment · {label} · error", "value": _norm(ef.get("error"))})

    parsed: list[dict[str, str]] = []
    parsed.extend(parse_fields_from_text(body_text))

    for ef in expected_files:
        parsed.extend(parse_fields_from_text(ef.get("clean_text")))
        parsed.extend(load_excel_fields(ef.get("structured_data_path")))

    for att in attachments:
        parsed.extend(parse_fields_from_text(att.get("clean_text")))
        parsed.extend(load_excel_fields(att.get("structured_data_path")))

    for row in parsed:
        if row["field"].lower() not in {r["field"].lower() for r in rows}:
            rows.append(row)

    return rows
