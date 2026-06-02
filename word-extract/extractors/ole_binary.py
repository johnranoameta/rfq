"""Extract embedded binaries from legacy .doc ObjectPool / CONTENTS streams."""

from __future__ import annotations

import gc
import re
from pathlib import Path
from typing import Any

import sys

import olefile

# Stream name -> file extension for repacked OLE containers
_WORD_STREAMS = frozenset(
    {"WordDocument", "1Table", "Data", "\x01CompObj", "\x03ObjInfo"}
)
_EXCEL_MARKER = "Workbook"


def _safe_filename(name: str, fallback: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name.strip())
    return cleaned or fallback


def _pool_prog_hint(ole: olefile.OleFileIO, pool_id: str) -> str:
    try:
        comp = ole.openstream(["ObjectPool", pool_id, "\x01CompObj"]).read()
        strings = re.findall(rb"[\x20-\x7e]{4,}", comp)
        return strings[1].decode("ascii", "ignore") if len(strings) > 1 else ""
    except OSError:
        return ""


def _repack_streams_to_file(streams: dict[str, bytes], out_path: Path) -> None:
    if sys.platform != "win32":
        raise OSError(
            "OLE repack for embedded Word/Excel requires Windows COM "
            "(use Linux LibreOffice path for main document text)"
        )
    import gc

    import pythoncom
    from win32com.storagecon import STGM_CREATE, STGM_READWRITE, STGM_SHARE_EXCLUSIVE

    if out_path.exists():
        out_path.unlink()
    stg = pythoncom.StgCreateDocfile(
        str(out_path), STGM_READWRITE | STGM_SHARE_EXCLUSIVE | STGM_CREATE, 0
    )
    try:
        for name, data in streams.items():
            stream = stg.CreateStream(
                name, STGM_READWRITE | STGM_SHARE_EXCLUSIVE | STGM_CREATE
            )
            stream.Write(data)
        stg.Commit(0)
    finally:
        del stg
        gc.collect()


def _label_queues(
    inline_shapes: list[dict[str, Any]] | None,
) -> dict[str, list[str]]:
    """Build per-type queues of icon labels from Word inline shape metadata."""
    queues: dict[str, list[str]] = {"pdf": [], "excel": [], "word": []}
    if not inline_shapes:
        return queues
    for shape in inline_shapes:
        ole = shape.get("ole") or {}
        prog = (ole.get("prog_id") or "").lower()
        label = (ole.get("icon_label") or "").strip()
        if not label:
            continue
        if "acrobat" in prog or prog.endswith(".pdf"):
            queues["pdf"].append(label)
        elif "excel" in prog or prog.endswith(".xls"):
            queues["excel"].append(label)
        elif "word" in prog:
            queues["word"].append(label)
    return queues


def _next_label(queues: dict[str, list[str]], kind: str, pool_id: str) -> str:
    if queues.get(kind):
        return queues[kind].pop(0)
    return pool_id


def extract_object_pool(
    doc_path: Path,
    output_dir: Path,
    *,
    inline_shapes: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """
    Walk ObjectPool storages in a legacy .doc and write embedded files to output_dir.

    When inline_shapes metadata is supplied (from Word COM), icon labels are applied to
    output filenames in document order per file type.

    Returns metadata for each extracted artifact.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []
    label_queues = _label_queues(inline_shapes)
    used_names: set[str] = set()

    def unique_name(label: str, ext: str) -> str:
        safe = _safe_filename(label, "embedded")
        if safe.lower().endswith(ext):
            name = safe
        else:
            name = safe + ext
        if name not in used_names:
            used_names.add(name)
            return name
        stem = Path(name).stem
        n = 2
        while True:
            candidate = f"{stem}_{n}{ext}"
            if candidate not in used_names:
                used_names.add(candidate)
                return candidate
            n += 1

    with olefile.OleFileIO(str(doc_path)) as ole:
        pool_ids = sorted(
            {
                entry[1]
                for entry in ole.listdir()
                if entry[0] == "ObjectPool" and len(entry) >= 2
            }
        )

        for pool_id in pool_ids:
            prefix = ["ObjectPool", pool_id]
            stream_entries = [
                e for e in ole.listdir() if e[:2] == prefix and len(e) == 3
            ]
            if not stream_entries:
                continue

            streams: dict[str, bytes] = {}
            for entry in stream_entries:
                name = entry[2]
                streams[name] = ole.openstream(entry).read()

            hint = _pool_prog_hint(ole, pool_id)
            record: dict[str, Any] = {
                "pool_id": pool_id,
                "prog_hint": hint,
                "stream_names": list(streams.keys()),
                "extraction_method": "ole_object_pool",
            }

            # PDF payloads are stored raw in CONTENTS
            contents = streams.get("CONTENTS")
            if contents and contents.startswith(b"%PDF"):
                label = _next_label(label_queues, "pdf", pool_id)
                out_name = unique_name(label, ".pdf")
                out_path = output_dir / out_name
                out_path.write_bytes(contents)
                record.update(
                    {
                        "type": "pdf",
                        "filename": out_name,
                        "path": str(out_path),
                        "size_bytes": len(contents),
                    }
                )
                results.append(record)
                continue

            # Excel workbook
            if _EXCEL_MARKER in streams:
                label = _next_label(label_queues, "excel", pool_id)
                out_name = unique_name(label, ".xls")
                out_path = output_dir / out_name
                try:
                    _repack_streams_to_file(streams, out_path)
                    record.update(
                        {
                            "type": "excel",
                            "filename": out_name,
                            "path": str(out_path),
                            "size_bytes": out_path.stat().st_size,
                        }
                    )
                except OSError as exc:
                    record.update(
                        {
                            "type": "excel",
                            "filename": out_name,
                            "export_skipped": str(exc),
                        }
                    )
                results.append(record)
                continue

            # Word sub-document
            if "WordDocument" in streams:
                label = _next_label(label_queues, "word", pool_id)
                out_name = unique_name(label, ".doc")
                out_path = output_dir / out_name
                try:
                    _repack_streams_to_file(streams, out_path)
                    record.update(
                        {
                            "type": "word",
                            "filename": out_name,
                            "path": str(out_path),
                            "size_bytes": out_path.stat().st_size,
                        }
                    )
                except OSError as exc:
                    record.update(
                        {
                            "type": "word",
                            "filename": out_name,
                            "export_skipped": str(exc),
                        }
                    )
                results.append(record)
                continue

            # Unknown pool — dump streams manifest only
            record["type"] = "unknown"
            record["note"] = "Unrecognized ObjectPool layout; streams not exported"
            results.append(record)

    return results
