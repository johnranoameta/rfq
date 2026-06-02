"""Normalize raw RFQ extraction output for AI comparison and retrieval."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from extractors.role_classifier import classify_role
from extractors.section_parser import (
    SectionMapping,
    apply_section_metadata,
    lookup_section_for_filename,
    map_inline_shapes_to_sections,
    parse_sections,
    sections_to_dicts,
)
from extractors.section_slots import build_section_slots, _merged_section_catalog
from extractors.text_clean import chunk_text, clean_text, estimate_tokens, paragraphs_to_text


def _sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _rfq_number_from_name(name: str) -> str | None:
    m = re.search(r"(\d{8,})", name)
    return m.group(1) if m else None


def _title_author(record: dict[str, Any]) -> tuple[str | None, str | None]:
    props = record.get("properties") or {}
    built_in = props.get("built_in") or {}
    core = props.get("core") or {}
    return (
        built_in.get("Title") or core.get("title"),
        built_in.get("Author") or core.get("author"),
    )


def _excel_to_text(excel_data: dict[str, Any] | None) -> str:
    if not excel_data:
        return ""
    parts: list[str] = []
    for sheet in excel_data.get("sheets") or []:
        name = sheet.get("name") or f"Sheet{sheet.get('index')}"
        parts.append(f"[Sheet: {name}]")
        for row in (sheet.get("values") or [])[:50]:
            cells = [str(c) if c is not None else "" for c in row]
            line = "\t".join(cells).strip()
            if line:
                parts.append(line)
    return clean_text("\n".join(parts))


def _load_json_path(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None
    p = Path(path)
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def _attachment_text(item: dict[str, Any]) -> str:
    pdf = item.get("pdf_text") or {}
    if pdf.get("full_text"):
        return clean_text(pdf["full_text"])
    excel = _load_json_path(item.get("structured_data"))
    if excel:
        return _excel_to_text(excel)
    return ""


def _collect_pool_attachments(
    record: dict[str, Any],
    section_mappings: list,
) -> list[dict[str, Any]]:
    """Object pool files are the canonical binary source (deduped by sha256)."""
    by_hash: dict[str, dict[str, Any]] = {}

    for item in record.get("object_pool_files") or []:
        path = item.get("path")
        if not path or item.get("type") == "unknown":
            continue
        p = Path(path)
        digest = _sha256(p)
        filename = item.get("filename") or p.name
        candidate = {
            "filename": filename,
            "file_type": item.get("type"),
            "file_path": str(p.resolve()),
            "size_bytes": item.get("size_bytes"),
            "sha256": digest,
            "document_role": classify_role(filename, file_type=item.get("type")),
            "clean_text": _attachment_text(item),
            "structured_data_path": item.get("structured_data"),
            "pdf_text_path": (item.get("pdf_text") or {}).get("text_export"),
            "error": item.get("pdf_text_error") or item.get("structured_data_error"),
        }
        mapping = lookup_section_for_filename(filename, section_mappings)
        apply_section_metadata(candidate, mapping)
        if not digest:
            by_hash[f"path:{p.resolve()}"] = candidate
            continue
        existing = by_hash.get(digest)
        if existing is None or (
            existing["filename"].startswith("_")
            and not filename.startswith("_")
        ):
            by_hash[digest] = candidate

    return list(by_hash.values())


def _document_record(
    record: dict[str, Any],
    section_mappings: list | None = None,
) -> dict[str, Any]:
    source = record.get("source", "")
    path = Path(source)
    title, author = _title_author(record)
    clean = paragraphs_to_text(record.get("paragraphs") or [])
    if not clean and record.get("full_text_export"):
        try:
            clean = clean_text(Path(record["full_text_export"]).read_text(encoding="utf-8", errors="replace"))
        except Exception:
            pass

    doc = {
        "source_path": source,
        "filename": path.name,
        "depth": record.get("depth", 0),
        "suffix": record.get("suffix"),
        "document_role": classify_role(path.name, depth=record.get("depth", 0)),
        "title": title,
        "author": author,
        "clean_text": clean,
        "char_count": len(clean),
        "token_estimate": estimate_tokens(clean),
        "statistics": record.get("statistics"),
        "error": record.get("error"),
        "chunks": chunk_text(clean),
    }

    if record.get("depth", 0) == 0:
        doc["section_number"] = None
        doc["section_title"] = "Main RFQ Document"
        doc["section_display"] = "Main RFQ Document"
        doc["section_path"] = "root"
    elif section_mappings:
        mapping = lookup_section_for_filename(path.name, section_mappings)
        apply_section_metadata(doc, mapping)

    return doc


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    """Transform one raw extraction record into a comparison-ready package."""
    source = record.get("source", "")
    path = Path(source)
    title, author = _title_author(record)

    section_mappings: list[SectionMapping] = (
        map_inline_shapes_to_sections(record) if record.get("depth", 0) == 0 else []
    )
    parsed_sections = sections_to_dicts(parse_sections(record.get("paragraphs") or []))
    sections = _merged_section_catalog(parsed_sections, section_mappings)

    documents: list[dict[str, Any]] = [_document_record(record, section_mappings)]
    for child in record.get("children") or []:
        documents.append(_document_record(child, section_mappings))

    attachments = _collect_pool_attachments(record, section_mappings)
    seen_hashes: set[str] = {a["sha256"] for a in attachments if a.get("sha256")}

    all_chunks: list[dict[str, Any]] = []
    for doc in documents:
        for i, chunk in enumerate(doc.pop("chunks", [])):
            all_chunks.append(
                {
                    "source_kind": "document",
                    "source_filename": doc["filename"],
                    "document_role": doc["document_role"],
                    "section_number": doc.get("section_number"),
                    "section_title": doc.get("section_title"),
                    "section_display": doc.get("section_display"),
                    "section_path": doc.get("section_path"),
                    "chunk_index": i,
                    "text": chunk,
                    "char_count": len(chunk),
                    "token_estimate": estimate_tokens(chunk),
                }
            )

    for att in attachments:
        for i, chunk in enumerate(chunk_text(att["clean_text"])):
            all_chunks.append(
                {
                    "source_kind": "attachment",
                    "source_filename": att["filename"],
                    "document_role": att["document_role"],
                    "section_number": att.get("section_number"),
                    "section_title": att.get("section_title"),
                    "section_display": att.get("section_display"),
                    "section_path": att.get("section_path"),
                    "chunk_index": i,
                    "text": chunk,
                    "char_count": len(chunk),
                    "token_estimate": estimate_tokens(chunk),
                }
            )

    section_slots = (
        build_section_slots(
            sections=sections,
            mappings=section_mappings,
            section_content=record.get("section_content"),
            attachments=attachments,
            documents=documents,
        )
        if record.get("depth", 0) == 0
        else []
    )

    return {
        "package_id": path.stem,
        "source_path": source,
        "filename": path.name,
        "rfq_number": _rfq_number_from_name(path.name),
        "title": title,
        "author": author,
        "normalized_at": datetime.now(timezone.utc).isoformat(),
        "file_sha256": _sha256(path) if path.is_file() else None,
        "summary": {
            "document_count": len(documents),
            "attachment_count": len(attachments),
            "unique_attachment_hashes": len(seen_hashes),
            "chunk_count": len(all_chunks),
            "section_count": len(sections),
            "section_slot_count": len(section_slots),
            "roles": sorted({d["document_role"] for d in documents} | {a["document_role"] for a in attachments}),
        },
        "sections": sections,
        "section_slots": section_slots,
        "section_mappings": [
            {
                "inline_index": m.inline_index,
                "icon_label": m.icon_label,
                "section_number": m.section_number,
                "section_title": m.section_title,
                "section_display": m.section_display,
                "section_path": m.section_path,
                "paragraph_index": m.paragraph_index,
            }
            for m in section_mappings
        ],
        "documents": documents,
        "attachments": attachments,
        "chunks": all_chunks,
    }


def normalize_manifest(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [normalize_record(r) for r in records]
