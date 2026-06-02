"""Parse numbered RFQ section hierarchy and map embedded files to sections."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

SECTION_HEADING = re.compile(
    r"^(\d+(?:\.\d+)*)\.?\s+(.+?)\.?\s*$"
)
INTRO_LABEL = re.compile(
    r"(?:->\s*)?(.+?)(?:\s*:|\s*$)",
    re.I,
)
OLE_CHAR = "\x01"


@dataclass
class Section:
    number: str
    title: str
    paragraph_index: int
    level: int
    parent_number: str | None
    style: str = ""

    @property
    def display(self) -> str:
        return f"{self.number} {self.title}"

    @property
    def path(self) -> str:
        parts = self.number.split(".")
        titles: list[str] = []
        # path uses numbers only: "1 > 1.1"
        for i in range(len(parts)):
            titles.append(".".join(parts[: i + 1]))
        return " > ".join(titles)


@dataclass
class SectionMapping:
    inline_index: int
    icon_label: str
    section_number: str | None
    section_title: str | None
    section_display: str | None
    section_path: str | None
    paragraph_index: int


def _line(text: str) -> str:
    line = (text or "").replace("\r", "\n").split("\n")[0]
    line = re.sub(r"^[\x00-\x1f]+", "", line).strip()
    return re.sub(r"\s+", " ", line)


def _level(number: str) -> int:
    return number.count(".") + 1


def _parent_number(number: str) -> str | None:
    if "." not in number:
        return None
    return ".".join(number.split(".")[:-1])


def parse_sections(paragraphs: list[dict[str, Any]]) -> list[Section]:
    sections: list[Section] = []
    for para in paragraphs:
        text = _line(para.get("text") or "")
        if not text:
            continue
        m = SECTION_HEADING.match(text)
        if not m:
            continue
        number = m.group(1)
        title = m.group(2).strip().rstrip(".")
        # Filter false positives (phone numbers etc.)
        if len(title) < 4 and title.replace(" ", "").isdigit():
            continue
        if number == "248" or title.isdigit():
            continue
        sections.append(
            Section(
                number=number,
                title=title,
                paragraph_index=para.get("index", 0),
                level=_level(number),
                parent_number=_parent_number(number),
                style=para.get("style") or "",
            )
        )
    return sections


def _infer_intro_label(paragraphs: list[dict[str, Any]], ole_para_index: int) -> tuple[str, str]:
    """Infer a label for attachments placed before numbered sections."""
    by_index = {p.get("index"): p for p in paragraphs}
    for back in range(1, 4):
        prev = by_index.get(ole_para_index - back)
        if not prev:
            continue
        text = _line(prev.get("text") or "")
        if not text or OLE_CHAR in text:
            continue
        if text.lower().startswith("please double"):
            continue
        clean = text.lstrip("-→> ").strip().rstrip(":")
        if len(clean) > 3:
            return "intro", clean
    return "intro", "Introduction"


def _section_at_paragraph(sections: list[Section], para_index: int) -> Section | None:
    current: Section | None = None
    for sec in sections:
        if sec.paragraph_index <= para_index:
            current = sec
        else:
            break
    return current


def map_inline_shapes_to_sections(record: dict[str, Any]) -> list[SectionMapping]:
    paragraphs = record.get("paragraphs") or []
    shapes = record.get("inline_shapes") or []
    sections = parse_sections(paragraphs)
    sections_sorted = sorted(sections, key=lambda s: s.paragraph_index)

    mappings: list[SectionMapping] = []
    shape_idx = 0
    intro_counter = 0

    for para in paragraphs:
        text = para.get("text") or ""
        if OLE_CHAR not in text:
            continue

        para_index = para.get("index", 0)
        current = _section_at_paragraph(sections_sorted, para_index)
        count = text.count(OLE_CHAR)

        for _ in range(count):
            if shape_idx >= len(shapes):
                break
            shape = shapes[shape_idx]
            ole = shape.get("ole") or {}
            icon = ole.get("icon_label") or f"embedded_{shape.get('index')}"

            if current:
                sec_num = current.number
                sec_title = current.title
                sec_display = current.display
                sec_path = current.path
            else:
                intro_counter += 1
                _, sec_title = _infer_intro_label(paragraphs, para_index)
                sec_num = f"0.{intro_counter}"
                sec_display = f"{sec_num} {sec_title}"
                sec_path = sec_num

            mappings.append(
                SectionMapping(
                    inline_index=shape.get("index", shape_idx + 1),
                    icon_label=icon,
                    section_number=sec_num,
                    section_title=sec_title,
                    section_display=sec_display,
                    section_path=sec_path,
                    paragraph_index=para_index,
                )
            )
            shape_idx += 1

    return mappings


def mapping_by_icon_label(mappings: list[SectionMapping]) -> dict[str, SectionMapping]:
    result: dict[str, SectionMapping] = {}
    for m in mappings:
        key = m.icon_label.lower()
        result[key] = m
        # also store by stem without extension
        stem = key.rsplit(".", 1)[0] if "." in key else key
        result.setdefault(stem, m)
    return result


def sections_to_dicts(sections: list[Section]) -> list[dict[str, Any]]:
    return [
        {
            "number": s.number,
            "title": s.title,
            "display": s.display,
            "path": s.path,
            "level": s.level,
            "parent_number": s.parent_number,
            "paragraph_index": s.paragraph_index,
            "style": s.style,
        }
        for s in sections
    ]


def lookup_section_for_filename(
    filename: str,
    mappings: list[SectionMapping],
) -> SectionMapping | None:
    name = filename.lower()
    stem = name.rsplit(".", 1)[0] if "." in name else name
    by_label = mapping_by_icon_label(mappings)
    if name in by_label:
        return by_label[name]
    if stem in by_label:
        return by_label[stem]
    for m in mappings:
        label = m.icon_label.lower()
        if stem in label or label.startswith(stem) or stem.startswith(label.rsplit(".", 1)[0]):
            return m
    return None


def apply_section_metadata(
    item: dict[str, Any],
    mapping: SectionMapping | None,
) -> None:
    if not mapping:
        item["section_number"] = None
        item["section_title"] = None
        item["section_display"] = None
        item["section_path"] = None
        return
    item["section_number"] = mapping.section_number
    item["section_title"] = mapping.section_title
    item["section_display"] = mapping.section_display
    item["section_path"] = mapping.section_path
