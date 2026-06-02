"""Build per-section template slots for normalized RFQ packages (including empty placeholders)."""

from __future__ import annotations

from typing import Any

from extractors.field_parser import build_section_fields
from extractors.section_parser import SectionMapping
from extractors.text_clean import clean_text


def _section_sort_key(number: str) -> tuple:
    parts: list[Any] = []
    for part in number.split("."):
        parts.append(int(part) if part.isdigit() else part)
    return tuple(parts)


def _merged_section_catalog(
    sections: list[dict[str, Any]],
    mappings: list[SectionMapping],
) -> list[dict[str, Any]]:
    """Union of parsed headings and intro/mapped sections (0.1, …)."""
    by_num: dict[str, dict[str, Any]] = {s["number"]: dict(s) for s in sections}

    for m in mappings:
        num = m.section_number
        if not num or num in by_num:
            continue
        level = num.count(".") + (1 if num.startswith("0") else 1)
        by_num[num] = {
            "number": num,
            "title": m.section_title or "",
            "display": m.section_display or f"{num} {m.section_title or ''}".strip(),
            "path": m.section_path or num,
            "level": level,
            "parent_number": ".".join(num.split(".")[:-1]) if "." in num else None,
            "paragraph_index": m.paragraph_index,
            "style": "mapped",
        }

    return sorted(by_num.values(), key=lambda s: _section_sort_key(s["number"]))


def _match_expected_file(
    icon_label: str,
    attachments: list[dict[str, Any]],
    documents: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Return (attachment, document) if present for an expected icon label."""
    label_lower = icon_label.lower()
    stem = label_lower.rsplit(".", 1)[0] if "." in label_lower else label_lower

    att_hit = None
    for att in attachments:
        fn = (att.get("filename") or "").lower()
        if fn == label_lower or fn.startswith(stem) or stem in fn:
            att_hit = att
            break

    doc_hit = None
    for doc in documents:
        if doc.get("depth", 0) == 0:
            continue
        fn = (doc.get("filename") or "").lower()
        if fn == label_lower or fn.startswith(stem) or stem in fn:
            doc_hit = doc
            break

    return att_hit, doc_hit


def _slot_status(
    *,
    body_text: str,
    expected: list[dict[str, Any]],
    attachments: list[dict[str, Any]],
) -> str:
    missing_expected = any(e.get("expected") and not e.get("present") for e in expected)
    has_body = bool(body_text.strip())
    has_att = bool(attachments)

    if missing_expected:
        return "missing_attachment"
    if has_body or has_att:
        return "complete"
    if expected:
        return "partial"
    return "empty"


def build_section_slots(
    *,
    sections: list[dict[str, Any]],
    mappings: list[SectionMapping],
    section_content: list[dict[str, Any]] | None,
    attachments: list[dict[str, Any]],
    documents: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    One row per template section with body text and attachment slots (empty when missing).
    """
    catalog = _merged_section_catalog(sections, mappings)
    body_by_num = {
        str(s.get("section_number")): clean_text(s.get("raw_text") or "")
        for s in (section_content or [])
    }

    # Group mappings by section
    mappings_by_num: dict[str, list[SectionMapping]] = {}
    for m in mappings:
        num = m.section_number or "unmapped"
        mappings_by_num.setdefault(num, []).append(m)

    slots: list[dict[str, Any]] = []

    for sec in catalog:
        num = sec["number"]
        body_text = body_by_num.get(num, "")
        sec_attachments = [
            a
            for a in attachments
            if a.get("section_number") == num
        ]
        sec_documents = [
            d
            for d in documents
            if d.get("section_number") == num and d.get("depth", 0) > 0
        ]

        expected_files: list[dict[str, Any]] = []
        seen_labels: set[str] = set()

        for m in mappings_by_num.get(num, []):
            label = m.icon_label
            key = label.lower()
            if key in seen_labels:
                continue
            seen_labels.add(key)

            att, doc = _match_expected_file(label, attachments, documents)
            present = att is not None or doc is not None
            clean = (att or {}).get("clean_text") or (doc or {}).get("clean_text") or ""

            expected_files.append(
                {
                    "icon_label": label,
                    "inline_index": m.inline_index,
                    "expected": True,
                    "present": present,
                    "filename": (att or doc or {}).get("filename"),
                    "file_type": (att or {}).get("file_type"),
                    "document_role": (att or doc or {}).get("document_role"),
                    "file_path": (att or {}).get("file_path") or (doc or {}).get("source_path"),
                    "sha256": (att or {}).get("sha256"),
                    "structured_data_path": (att or {}).get("structured_data_path"),
                    "clean_text": clean,
                    "char_count": len(clean),
                    "error": (att or doc or {}).get("error"),
                }
            )

        # Attachments in section not tied to a mapping (e.g. extra PDFs under section 4)
        for att in sec_attachments:
            fn = (att.get("filename") or "").lower()
            if any(
                fn == (e.get("filename") or "").lower()
                or fn == (e.get("icon_label") or "").lower()
                for e in expected_files
            ):
                continue
            clean = att.get("clean_text") or ""
            expected_files.append(
                {
                    "icon_label": att.get("filename"),
                    "inline_index": None,
                    "expected": False,
                    "present": True,
                    "filename": att.get("filename"),
                    "file_type": att.get("file_type"),
                    "document_role": att.get("document_role"),
                    "file_path": att.get("file_path"),
                    "sha256": att.get("sha256"),
                    "structured_data_path": att.get("structured_data_path"),
                    "clean_text": clean,
                    "char_count": len(clean),
                    "error": att.get("error"),
                }
            )

        status = _slot_status(
            body_text=body_text,
            expected=expected_files,
            attachments=sec_attachments,
        )

        slot_attachments = [
            {
                "filename": a.get("filename"),
                "file_type": a.get("file_type"),
                "document_role": a.get("document_role"),
                "file_path": a.get("file_path"),
                "sha256": a.get("sha256"),
                "structured_data_path": a.get("structured_data_path"),
                "clean_text": a.get("clean_text") or "",
                "char_count": len(a.get("clean_text") or ""),
                "error": a.get("error"),
            }
            for a in sec_attachments
        ]

        fields = build_section_fields(
            section_number=num,
            section_display=sec.get("display"),
            status=status,
            body_text=body_text,
            expected_files=expected_files,
            attachments=slot_attachments,
        )

        slots.append(
            {
                "section_number": num,
                "section_title": sec.get("title"),
                "section_display": sec.get("display"),
                "section_path": sec.get("path"),
                "level": sec.get("level"),
                "parent_number": sec.get("parent_number"),
                "paragraph_index": sec.get("paragraph_index"),
                "body_text": body_text,
                "body_char_count": len(body_text),
                "status": status,
                "expected_files": expected_files,
                "attachments": slot_attachments,
                "documents": [
                    {
                        "filename": d.get("filename"),
                        "document_role": d.get("document_role"),
                        "source_path": d.get("source_path"),
                        "clean_text": d.get("clean_text") or "",
                        "char_count": d.get("char_count", 0),
                        "error": d.get("error"),
                    }
                    for d in sec_documents
                ],
                "fields": fields,
            }
        )

    return slots
