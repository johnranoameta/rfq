"""Extract Word document content and embedded OLE objects via Microsoft Word COM."""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pywintypes
import win32com.client

_RPC_CALL_REJECTED = -2147418111

# Word constants (avoid makepy dependency)
_WD_INLINE_EMBEDDED = 1
_WD_FORMAT_DOC = 0
_WD_FORMAT_DOCX = 12
_WD_FORMAT_PDF = 17
_WD_FORMAT_TEXT = 2


def _format_com_error(exc: BaseException) -> str:
    if isinstance(exc, pywintypes.com_error):
        detail = exc.excepinfo[2] if exc.excepinfo else exc.strerror
        return f"Word COM error ({exc.hresult}): {detail or exc}"
    return str(exc)


def _safe_close_document(doc: Any | None) -> None:
    if doc is None:
        return
    try:
        doc.Close(False)
    except Exception:
        pass


def _open_document(word: Any, doc_path: Path) -> Any:
    """Open a document and verify Word returned a real Document object."""
    path = str(doc_path.resolve())
    last_exc: BaseException | None = None

    for attempt in range(5):
        doc = None
        try:
            doc = word.Documents.Open(
                FileName=path,
                ConfirmConversions=False,
                ReadOnly=True,
                AddToRecentFiles=False,
                NoEncodingDialog=True,
                OpenAndRepair=True,
            )
            _ = doc.Name
            _ = doc.Paragraphs.Count
            return doc
        except pywintypes.com_error as exc:
            last_exc = exc
            _safe_close_document(doc)
            if exc.hresult == _RPC_CALL_REJECTED and attempt < 4:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise RuntimeError(_format_com_error(exc)) from exc
        except AttributeError as exc:
            _safe_close_document(doc)
            raise RuntimeError(
                f"Word did not open the document (got invalid COM object). Path: {path}"
            ) from exc

    raise RuntimeError(_format_com_error(last_exc) if last_exc else "Word failed to open document")


def _safe_filename(name: str, fallback: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name.strip())
    return cleaned or fallback


def _com_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    try:
        return str(value)
    except Exception:
        return repr(value)


def _extract_properties(doc: Any) -> dict[str, Any]:
    props: dict[str, Any] = {}
    for i in range(1, doc.BuiltInDocumentProperties.Count + 1):
        try:
            prop = doc.BuiltInDocumentProperties(i)
            props[prop.Name] = _com_value(prop.Value)
        except Exception:
            continue
    custom: dict[str, Any] = {}
    try:
        for i in range(1, doc.CustomDocumentProperties.Count + 1):
            try:
                prop = doc.CustomDocumentProperties(i)
                custom[str(prop.Name)] = _com_value(prop.Value)
            except Exception:
                continue
    except Exception:
        pass
    return {"built_in": props, "custom": custom}


def _extract_paragraphs(doc: Any) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for i in range(1, doc.Paragraphs.Count + 1):
        para = doc.Paragraphs(i)
        text = para.Range.Text
        if text:
            text = text.replace("\r", "\n").replace("\x07", "")
        style_name = ""
        try:
            style_name = para.Style.NameLocal
        except Exception:
            pass
        items.append(
            {
                "index": i,
                "text": text,
                "style": style_name,
                "outline_level": _com_value(getattr(para, "OutlineLevel", None)),
            }
        )
    return items


def _extract_tables(doc: Any) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    for t_idx in range(1, doc.Tables.Count + 1):
        table = doc.Tables(t_idx)
        rows_data: list[list[dict[str, Any]]] = []
        for r in range(1, table.Rows.Count + 1):
            row_cells: list[dict[str, Any]] = []
            for c in range(1, table.Columns.Count + 1):
                try:
                    cell = table.Cell(r, c)
                    cell_text = cell.Range.Text.replace("\r", "\n").replace("\x07", "")
                except Exception:
                    cell_text = ""
                row_cells.append({"row": r, "col": c, "text": cell_text})
            rows_data.append(row_cells)
        tables.append(
            {
                "index": t_idx,
                "rows": table.Rows.Count,
                "columns": table.Columns.Count,
                "cells": rows_data,
            }
        )
    return tables


def _extract_hyperlinks(doc: Any) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    for i in range(1, doc.Hyperlinks.Count + 1):
        link = doc.Hyperlinks(i)
        links.append(
            {
                "index": i,
                "text": _com_value(link.TextToDisplay),
                "address": _com_value(link.Address),
                "sub_address": _com_value(link.SubAddress),
                "screen_tip": _com_value(link.ScreenTip),
            }
        )
    return links


def _extract_headers_footers(doc: Any) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    for s_idx in range(1, doc.Sections.Count + 1):
        section = doc.Sections(s_idx)
        sec_data: dict[str, Any] = {"section_index": s_idx, "headers": [], "footers": []}
        for kind, key in (
            (1, "headers"),  # wdHeaderFooterPrimary
            (2, "footers"),
        ):
            try:
                hf = section.Headers(kind) if key == "headers" else section.Footers(kind)
                text = hf.Range.Text.replace("\r", "\n").replace("\x07", "")
                sec_data[key].append({"type": "primary", "text": text})
            except Exception:
                pass
        sections.append(sec_data)
    return sections


def _extract_inline_shapes(doc: Any, embed_dir: Path) -> list[dict[str, Any]]:
    embed_dir.mkdir(parents=True, exist_ok=True)
    shapes: list[dict[str, Any]] = []

    for i in range(1, doc.InlineShapes.Count + 1):
        sh = doc.InlineShapes(i)
        record: dict[str, Any] = {
            "index": i,
            "type": sh.Type,
            "width": _com_value(sh.Width),
            "height": _com_value(sh.Height),
        }
        try:
            ole = sh.OLEFormat
            record["ole"] = {
                "prog_id": ole.ProgID,
                "class_type": ole.ClassType,
                "icon_label": ole.IconLabel,
            }
            label = ole.IconLabel or f"embedded_{i}"
            safe_name = _safe_filename(label, f"embedded_{i}")
            prog = ole.ProgID or ""

            if sh.Type == _WD_INLINE_EMBEDDED and prog.startswith("Word.Document"):
                try:
                    obj = ole.Object
                    out_path = embed_dir / safe_name
                    if not out_path.suffix:
                        out_path = out_path.with_suffix(".doc")
                    obj.SaveAs(str(out_path), FileFormat=_WD_FORMAT_DOC)
                    record["saved_file"] = {
                        "path": str(out_path),
                        "method": "word_ole_saveas",
                        "size_bytes": out_path.stat().st_size,
                    }
                except Exception as exc:
                    record["saved_file"] = {
                        "error": str(exc),
                        "method": "word_ole_saveas",
                    }
        except Exception as exc:
            record["ole_error"] = str(exc)

        shapes.append(record)
    return shapes


def _extract_bookmarks(doc: Any) -> list[dict[str, Any]]:
    bookmarks: list[dict[str, Any]] = []
    for i in range(1, doc.Bookmarks.Count + 1):
        bm = doc.Bookmarks(i)
        bookmarks.append({"name": bm.Name, "start": bm.Start, "end": bm.End})
    return bookmarks


def _extract_footnotes_endnotes(doc: Any) -> dict[str, list[dict[str, Any]]]:
    footnotes: list[dict[str, Any]] = []
    for i in range(1, doc.Footnotes.Count + 1):
        fn = doc.Footnotes(i)
        footnotes.append(
            {
                "index": i,
                "reference": fn.Reference.Text if fn.Reference else "",
                "text": fn.Range.Text.replace("\r", "\n").replace("\x07", ""),
            }
        )
    endnotes: list[dict[str, Any]] = []
    for i in range(1, doc.Endnotes.Count + 1):
        en = doc.Endnotes(i)
        endnotes.append(
            {
                "index": i,
                "reference": en.Reference.Text if en.Reference else "",
                "text": en.Range.Text.replace("\r", "\n").replace("\x07", ""),
            }
        )
    return {"footnotes": footnotes, "endnotes": endnotes}


def extract_with_word(
    doc_path: Path,
    output_dir: Path,
    *,
    export_body_text: bool = True,
    word_app: Any | None = None,
    save_embedded: bool = True,
) -> dict[str, Any]:
    """
    Open a .doc/.docx via Word and return structured content plus embedded file paths.

    Pass word_app to reuse an existing Word.Application (recommended for batch runs).
    """
    doc_path = doc_path.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    embed_dir = output_dir / "embedded_via_word"
    embed_dir.mkdir(exist_ok=True)

    own_session = word_app is None
    word = word_app or win32com.client.DispatchEx("Word.Application")
    if own_session:
        try:
            word.Visible = False
        except Exception:
            pass
        word.DisplayAlerts = 0

    result: dict[str, Any] = {
        "source": str(doc_path),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "engine": "word_com",
    }

    doc = None
    try:
        doc = _open_document(word, doc_path)
        result["statistics"] = {
            "paragraphs": doc.Paragraphs.Count,
            "tables": doc.Tables.Count,
            "inline_shapes": doc.InlineShapes.Count,
            "sections": doc.Sections.Count,
            "hyperlinks": doc.Hyperlinks.Count,
            "bookmarks": doc.Bookmarks.Count,
        }
        result["properties"] = _extract_properties(doc)
        result["paragraphs"] = _extract_paragraphs(doc)
        result["tables"] = _extract_tables(doc)
        result["hyperlinks"] = _extract_hyperlinks(doc)
        result["headers_footers"] = _extract_headers_footers(doc)
        result["bookmarks"] = _extract_bookmarks(doc)
        result["notes"] = _extract_footnotes_endnotes(doc)
        if save_embedded:
            result["inline_shapes"] = _extract_inline_shapes(doc, embed_dir)
        else:
            result["inline_shapes"] = _extract_inline_shapes_readonly(doc)

        if export_body_text:
            txt_path = output_dir / f"{doc_path.stem}_full_text.txt"
            doc.SaveAs2(str(txt_path), FileFormat=_WD_FORMAT_TEXT)
            result["full_text_export"] = str(txt_path)
    finally:
        _safe_close_document(doc)
        if own_session:
            try:
                word.Quit()
            except Exception:
                pass

    return result


def _extract_inline_shapes_readonly(doc: Any) -> list[dict[str, Any]]:
    """Collect inline shape metadata without saving embedded Word files."""
    shapes: list[dict[str, Any]] = []
    for i in range(1, doc.InlineShapes.Count + 1):
        sh = doc.InlineShapes(i)
        record: dict[str, Any] = {
            "index": i,
            "type": sh.Type,
            "width": _com_value(sh.Width),
            "height": _com_value(sh.Height),
        }
        try:
            ole = sh.OLEFormat
            record["ole"] = {
                "prog_id": ole.ProgID,
                "class_type": ole.ClassType,
                "icon_label": ole.IconLabel,
            }
        except Exception as exc:
            record["ole_error"] = str(exc)
        shapes.append(record)
    return shapes
