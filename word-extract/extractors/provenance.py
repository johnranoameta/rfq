"""Attach section hierarchy and source provenance to raw extraction records."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from extractors.section_parser import (
    lookup_section_for_filename,
    map_inline_shapes_to_sections,
    parse_sections,
    sections_to_dicts,
)

OLE_CHAR = "\x01"


def _rfq_number(source: str) -> str | None:
    m = re.search(r"(\d{8,})", Path(source).name)
    return m.group(1) if m else None


def _paragraphs_for_section(
    paragraphs: list[dict[str, Any]],
    section_para_index: int,
    next_para_index: int | None,
) -> str:
    """Raw paragraph text between this section heading and the next."""
    parts: list[str] = []
    for para in paragraphs:
        idx = para.get("index", 0)
        if idx <= section_para_index:
            continue
        if next_para_index is not None and idx >= next_para_index:
            break
        text = para.get("text") or ""
        if OLE_CHAR in text and len(text.strip()) <= 3:
            continue
        if text.strip():
            parts.append(text.replace("\r", "\n"))
    return "\n".join(parts)


def _attachment_raw_text(item: dict[str, Any]) -> tuple[str, str]:
    """Return (raw_text, text_source_description)."""
    pdf = item.get("pdf_text") or {}
    if pdf.get("full_text"):
        src = pdf.get("text_export") or "pdf extraction"
        return pdf["full_text"], str(src)

    struct = item.get("structured_data")
    if struct and Path(struct).is_file():
        data = json.loads(Path(struct).read_text(encoding="utf-8"))
        lines = [f"File: {struct}", ""]
        for sheet in data.get("sheets") or []:
            lines.append(f"=== {sheet.get('name')} ===")
            for row in sheet.get("values") or []:
                lines.append("\t".join("" if c is None else str(c) for c in row))
        return "\n".join(lines), struct

    path = item.get("path")
    if path and Path(path).suffix.lower() in {".doc", ".docx"}:
        return "", f"Word binary: {path} (see nested extraction)"

    if path:
        return "", f"Binary: {path}"

    return "", "no text extracted"


def _mapping_dict(m: Any) -> dict[str, Any]:
    return {
        "inline_index": m.inline_index,
        "icon_label": m.icon_label,
        "section_number": m.section_number,
        "section_title": m.section_title,
        "section_display": m.section_display,
        "section_path": m.section_path,
        "paragraph_index": m.paragraph_index,
    }


def enrich_record(record: dict[str, Any], *, output_dir: str | None = None) -> dict[str, Any]:
    """
    Add sections, provenance, and a flat content index to a raw extraction record.
    Does not modify or clean extracted text.
    """
    if record.get("depth", 0) != 0:
        return record

    paragraphs = record.get("paragraphs") or []
    sections = parse_sections(paragraphs)
    mappings = map_inline_shapes_to_sections(record)
    mapping_by_label = {m.icon_label.lower(): m for m in mappings}

    record["rfq_number"] = _rfq_number(record.get("source", ""))
    record["output_dir"] = output_dir or str(Path(record.get("source", "")).parent)
    record["sections"] = sections_to_dicts(sections)

    section_para_indices = sorted(s.paragraph_index for s in sections)
    section_content: list[dict[str, Any]] = []

    for i, sec in enumerate(sections):
        next_idx = (
            section_para_indices[i + 1] if i + 1 < len(section_para_indices) else None
        )
        body = _paragraphs_for_section(paragraphs, sec.paragraph_index, next_idx)
        section_content.append(
            {
                "section_number": sec.number,
                "section_title": sec.title,
                "section_display": sec.display,
                "section_path": sec.path,
                "paragraph_index": sec.paragraph_index,
                "source_kind": "section_body",
                "raw_text": body,
                "text_source": f"main document paragraphs {sec.paragraph_index + 1}"
                + (f"–{next_idx - 1}" if next_idx else "+"),
                "provenance": {
                    "rfq_file": record.get("source"),
                    "location": f"Section {sec.display} in main RFQ document",
                    "origin_type": "main_document",
                },
            }
        )

    record["section_content"] = section_content

    for item in record.get("object_pool_files") or []:
        filename = item.get("filename") or Path(item.get("path", "")).name
        mapping = lookup_section_for_filename(filename, mappings)
        raw_text, text_source = _attachment_raw_text(item)

        item["provenance"] = {
            "rfq_file": record.get("source"),
            "embedded_file": item.get("path"),
            "section_number": mapping.section_number if mapping else None,
            "section_title": mapping.section_title if mapping else None,
            "section_display": mapping.section_display if mapping else None,
            "section_path": mapping.section_path if mapping else None,
            "location": (
                f"Section {mapping.section_display} → {filename}"
                if mapping
                else f"Embedded attachment → {filename}"
            ),
            "origin_type": "embedded_attachment",
            "inline_index": mapping.inline_index if mapping else None,
        }
        item["raw_text"] = raw_text
        item["text_source"] = text_source

    for shape in record.get("inline_shapes") or []:
        ole = shape.get("ole") or {}
        label = (ole.get("icon_label") or "").lower()
        mapping = mapping_by_label.get(label)
        if mapping:
            shape["provenance"] = {
                "section_number": mapping.section_number,
                "section_title": mapping.section_title,
                "section_display": mapping.section_display,
                "location": f"Section {mapping.section_display} (inline icon)",
            }

    for child in record.get("children") or []:
        child_name = Path(child.get("source", "")).name
        mapping = lookup_section_for_filename(child_name, mappings)
        child_paras = child.get("paragraphs") or []
        raw = "\n\n".join(
            (p.get("text") or "").replace("\r", "\n")
            for p in child_paras
            if (p.get("text") or "").strip()
        )
        if not raw and child.get("full_text_export"):
            try:
                raw = Path(child["full_text_export"]).read_text(encoding="utf-8", errors="replace")
            except Exception:
                pass

        child["provenance"] = {
            "rfq_file": record.get("source"),
            "nested_file": child.get("source"),
            "section_number": mapping.section_number if mapping else None,
            "section_title": mapping.section_title if mapping else None,
            "section_display": mapping.section_display if mapping else None,
            "location": (
                f"Section {mapping.section_display} → {child_name}"
                if mapping
                else f"Nested document → {child_name}"
            ),
            "origin_type": "nested_document",
        }
        child["raw_text"] = raw
        child["text_source"] = child.get("full_text_export") or "paragraphs"

    record["content_index"] = _build_content_index(record)
    record["section_mappings"] = [_mapping_dict(m) for m in mappings]
    return record


def _build_content_index(record: dict[str, Any]) -> list[dict[str, Any]]:
    """Flat list of all extractable content with provenance (for UI and future agent)."""
    items: list[dict[str, Any]] = []
    rfq = record.get("source", "")
    rfq_num = record.get("rfq_number")

    props = record.get("properties") or {}
    built_in = props.get("built_in") or {}

    items.append(
        {
            "id": "main",
            "source_kind": "main_document",
            "filename": Path(rfq).name,
            "content_type": "word",
            "section_display": "Main RFQ Document",
            "section_number": None,
            "raw_text": _main_raw_text(record),
            "text_source": record.get("full_text_export") or "paragraphs",
            "binary_path": rfq,
            "provenance": {
                "rfq_file": rfq,
                "rfq_number": rfq_num,
                "location": "Root RFQ package document",
                "title": built_in.get("Title"),
            },
        }
    )

    for sec in record.get("section_content") or []:
        if not sec.get("raw_text", "").strip():
            continue
        items.append(
            {
                "id": f"section_{sec['section_number']}",
                "source_kind": "section_body",
                "filename": Path(rfq).name,
                "content_type": "text",
                "section_number": sec["section_number"],
                "section_display": sec["section_display"],
                "raw_text": sec["raw_text"],
                "text_source": sec["text_source"],
                "binary_path": rfq,
                "provenance": sec["provenance"],
            }
        )

    for item in record.get("object_pool_files") or []:
        if item.get("type") in ("unknown", "excel_skipped", "word_skipped"):
            continue
        prov = item.get("provenance") or {}
        items.append(
            {
                "id": f"att_{item.get('filename', '')}",
                "source_kind": "embedded_attachment",
                "filename": item.get("filename"),
                "content_type": item.get("type"),
                "section_number": prov.get("section_number"),
                "section_display": prov.get("section_display"),
                "raw_text": item.get("raw_text") or "",
                "text_source": item.get("text_source"),
                "binary_path": item.get("path"),
                "provenance": prov,
                "error": item.get("pdf_text_error") or item.get("structured_data_error"),
            }
        )

    for child in record.get("children") or []:
        prov = child.get("provenance") or {}
        items.append(
            {
                "id": f"nested_{Path(child.get('source', '')).stem}",
                "source_kind": "nested_document",
                "filename": Path(child.get("source", "")).name,
                "content_type": "word",
                "section_number": prov.get("section_number"),
                "section_display": prov.get("section_display"),
                "raw_text": child.get("raw_text") or "",
                "text_source": child.get("text_source"),
                "binary_path": child.get("source"),
                "provenance": prov,
                "error": child.get("error"),
            }
        )

    return items


def _main_raw_text(record: dict[str, Any]) -> str:
    export = record.get("full_text_export")
    if export and Path(export).is_file():
        return Path(export).read_text(encoding="utf-8", errors="replace")
    return "\n\n".join(
        (p.get("text") or "").replace("\r", "\n")
        for p in record.get("paragraphs") or []
        if (p.get("text") or "").strip()
    )
