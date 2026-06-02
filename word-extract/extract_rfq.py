#!/usr/bin/env py
"""
Extract all content from RFQ-style Word documents (.doc / .docx).

Outputs:
  - extraction.json  — structured text, tables, metadata, embed manifest
  - embedded/        — binary files pulled from ObjectPool (PDF, XLS, DOC)
  - embedded_via_word/ — Word-saved embedded .doc files when COM allows
  - pdf_data/        — per-PDF text JSON
  - excel_data/      — per-XLS cell grid JSON
  - nested/          — recursive extractions of child documents

Requires Windows + Microsoft Word for .doc files.
Excel COM is used for embedded spreadsheet cell data (xlrd fallback on failure).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)
log = logging.getLogger("extract_rfq")

SUPPORTED = {".doc", ".docx"}


def _is_legacy_doc(path: Path) -> bool:
    with path.open("rb") as fh:
        magic = fh.read(4)
    return magic == b"\xd0\xcf\x11\xe0"  # OLE compound (legacy .doc)


def _dedupe_paths(paths: list[Path]) -> list[Path]:
    seen: set[str] = set()
    out: list[Path] = []
    for p in paths:
        key = str(p.resolve()).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def _collect_embedded_paths(record: dict) -> list[Path]:
    found: list[Path] = []
    word_via_com: set[str] = set()

    for shape in record.get("inline_shapes") or []:
        saved = shape.get("saved_file") or {}
        path = saved.get("path")
        if path and Path(path).exists():
            p = Path(path)
            found.append(p)
            word_via_com.add(p.name.lower())

    for item in record.get("object_pool_files") or []:
        path = item.get("path")
        if not path or not Path(path).exists():
            continue
        p = Path(path)
        if item.get("type") == "word" and p.name.lower() in word_via_com:
            continue
        found.append(p)

    for item in record.get("embedded_parts") or []:
        path = item.get("path")
        if path and Path(path).exists():
            found.append(Path(path))

    for child in record.get("children") or []:
        found.extend(_collect_embedded_paths(child))

    return found


def _extract_excel_item(
    xls_path: Path,
    output_dir: Path,
    xl_app: Any | None,
) -> dict[str, Any]:
    """Prefer xlrd for legacy .xls (faster, no COM/VBA issues); use Excel COM for .xlsx."""
    if xls_path.suffix.lower() == ".xls":
        try:
            from extractors.xls_fallback import extract_workbook_xlrd

            return extract_workbook_xlrd(xls_path)
        except Exception as xlrd_exc:
            log.warning("xlrd failed for %s: %s — trying Excel COM", xls_path.name, xlrd_exc)

    from extractors.excel_com import extract_workbook

    try:
        return extract_workbook(xls_path, xl_app=xl_app)
    except Exception as com_exc:
        if xls_path.suffix.lower() == ".xls":
            log.warning("Excel COM failed for %s: %s — trying xlrd", xls_path.name, com_exc)
            from extractors.xls_fallback import extract_workbook_xlrd

            return extract_workbook_xlrd(xls_path)
        raise


def _extract_pdf_item(pdf_path: Path, output_dir: Path) -> dict[str, Any]:
    from extractors.pdf_text import extract_pdf

    data = extract_pdf(pdf_path)
    out_json = output_dir / f"{pdf_path.stem}.json"
    out_json.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    data["json_path"] = str(out_json)
    txt_path = output_dir / f"{pdf_path.stem}.txt"
    txt_path.write_text(data.get("full_text", ""), encoding="utf-8")
    data["text_export"] = str(txt_path)
    return data


def extract_document(
    doc_path: Path,
    output_dir: Path,
    *,
    depth: int = 0,
    max_depth: int = 3,
    extract_excel_cells: bool = True,
    extract_pdf_text: bool = True,
    word_app: Any | None = None,
    xl_app: Any | None = None,
) -> dict:
    doc_path = doc_path.resolve()
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    log.info("[%s] Extracting %s", depth, doc_path.name)
    record: dict = {
        "source": str(doc_path),
        "depth": depth,
        "suffix": doc_path.suffix.lower(),
    }

    suffix = doc_path.suffix.lower()
    save_embedded = depth == 0

    if suffix == ".docx" or (suffix == ".doc" and not _is_legacy_doc(doc_path)):
        from extractors.docx_pure import extract_docx

        record.update(extract_docx(doc_path, output_dir))
    elif suffix == ".doc":
        from extractors.ole_binary import extract_object_pool
        from extractors.word_com import extract_with_word

        record.update(
            extract_with_word(
                doc_path,
                output_dir,
                word_app=word_app,
                save_embedded=save_embedded,
            )
        )
        pool_dir = output_dir / "embedded"
        record["object_pool_files"] = extract_object_pool(
            doc_path,
            pool_dir,
            inline_shapes=record.get("inline_shapes"),
        )
    elif suffix in (".xls", ".xlsx") and extract_excel_cells:
        record.update(_extract_excel_item(doc_path, output_dir, xl_app))
        return record
    else:
        record["error"] = f"Unsupported file type: {suffix}"
        return record

    pool_items = record.get("object_pool_files") or []

    if extract_pdf_text:
        pdf_dir = output_dir / "pdf_data"
        pdf_dir.mkdir(exist_ok=True)
        pdf_records: list[dict] = []
        for item in pool_items:
            if item.get("type") != "pdf":
                continue
            pdf_path = Path(item["path"])
            try:
                pdf_data = _extract_pdf_item(pdf_path, pdf_dir)
                item["pdf_text"] = pdf_data
                item["pdf_text_export"] = pdf_data.get("text_export")
                pdf_records.append(pdf_data)
            except Exception as exc:
                item["pdf_text_error"] = str(exc)
                log.warning("PDF text failed for %s: %s", pdf_path.name, exc)
        if pdf_records:
            record["pdf_extractions"] = pdf_records

    if extract_excel_cells and suffix == ".doc":
        excel_records: list[dict] = []
        binaries_dir = output_dir / "excel_data"
        binaries_dir.mkdir(exist_ok=True)

        for item in pool_items:
            if item.get("type") != "excel":
                continue
            xls_path = Path(item["path"])
            try:
                xl_data = _extract_excel_item(xls_path, binaries_dir, xl_app)
                out_json = binaries_dir / f"{xls_path.stem}.json"
                out_json.write_text(
                    json.dumps(xl_data, indent=2, ensure_ascii=False, default=str),
                    encoding="utf-8",
                )
                item["structured_data"] = str(out_json)
                excel_records.append(xl_data)
            except Exception as exc:
                item["structured_data_error"] = str(exc)
                log.warning("Excel extraction failed for %s: %s", xls_path.name, exc)
        if excel_records:
            record["excel_extractions"] = excel_records

    if depth < max_depth:
        children: list[dict] = []
        child_sources = _dedupe_paths(_collect_embedded_paths(record))
        for child_path in child_sources:
            if child_path.suffix.lower() not in SUPPORTED:
                continue
            child_out = output_dir / "nested" / child_path.stem
            child_out.mkdir(parents=True, exist_ok=True)
            try:
                children.append(
                    extract_document(
                        child_path,
                        child_out,
                        depth=depth + 1,
                        max_depth=max_depth,
                        extract_excel_cells=extract_excel_cells,
                        extract_pdf_text=False,
                        word_app=word_app,
                        xl_app=xl_app,
                    )
                )
            except Exception as exc:
                children.append(
                    {"source": str(child_path), "depth": depth + 1, "error": str(exc)}
                )
        if children:
            record["children"] = children

    if depth == 0:
        from extractors.provenance import enrich_record

        enrich_record(record, output_dir=str(output_dir))

    return record


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Extract all content from RFQ Word documents."
    )
    parser.add_argument(
        "input",
        nargs="?",
        default=".",
        help="Path to a .doc/.docx file or directory (default: current directory)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="output",
        help="Output directory for JSON and extracted files (default: output)",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=3,
        help="How deep to recurse into embedded Word documents (default: 3)",
    )
    parser.add_argument(
        "--no-excel-cells",
        action="store_true",
        help="Skip Excel cell extraction for embedded .xls files",
    )
    parser.add_argument(
        "--no-pdf-text",
        action="store_true",
        help="Skip PDF text extraction",
    )
    parser.add_argument(
        "--load-db",
        action="store_true",
        help="Load results into SQLite after extraction (output/rfq.db)",
    )
    parser.add_argument(
        "--normalize",
        action="store_true",
        help="Normalize extraction for AI comparison (output/normalized.json + rfq_normalized.db)",
    )
    args = parser.parse_args(argv)

    input_path = Path(args.input).resolve()
    output_root = Path(args.output).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    if input_path.is_file():
        sources = [input_path]
    elif input_path.is_dir():
        sources = sorted(
            p
            for p in input_path.iterdir()
            if p.is_file() and p.suffix.lower() in SUPPORTED
        )
    else:
        log.error("Input not found: %s", input_path)
        return 1

    if not sources:
        log.error("No .doc or .docx files found in %s", input_path)
        return 1

    if sys.platform != "win32":
        log.error(
            "Word COM extraction requires Windows with Microsoft Word and Excel installed. "
            "Linux hosts (including Amazon Linux EC2) are not supported. "
            "Deploy on Windows Server EC2 — see rfq-ui/docs/ec2-word-extraction.md."
        )
        return 2

    from extractors.com_sessions import ExcelSession, WordSession

    manifest: list[dict] = []
    with WordSession() as word_session, ExcelSession() as xl_session:
        for src in sources:
            doc_out = output_root / src.stem
            try:
                manifest.append(
                    extract_document(
                        src,
                        doc_out,
                        max_depth=args.max_depth,
                        extract_excel_cells=not args.no_excel_cells,
                        extract_pdf_text=not args.no_pdf_text,
                        word_app=word_session.app,
                        xl_app=xl_session.app,
                    )
                )
            except Exception as exc:
                log.exception("Failed on %s", src.name)
                manifest.append({"source": str(src), "error": str(exc)})

    manifest_path = output_root / "extraction.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    for entry in manifest:
        if entry.get("error"):
            continue
        pkg_dir = output_root / Path(entry.get("source", "")).stem
        if pkg_dir.is_dir():
            pkg_json = pkg_dir / "package.json"
            pkg_json.write_text(
                json.dumps(entry, indent=2, ensure_ascii=False, default=str),
                encoding="utf-8",
            )
    log.info("Wrote %s (%d document(s))", manifest_path, len(manifest))

    if args.load_db:
        from load_db import load_json, SCHEMA

        db_path = output_root / "rfq.db"
        if db_path.exists():
            db_path.unlink()
        import sqlite3

        conn = sqlite3.connect(str(db_path))
        conn.executescript(SCHEMA)
        count = load_json(conn, manifest_path)
        conn.close()
        log.info("Loaded %d document(s) into %s", count, db_path)

    if args.normalize:
        from normalize_rfq import load_normalized_sqlite
        from extractors.normalize import normalize_manifest

        packages = normalize_manifest(manifest)
        norm_json = output_root / "normalized.json"
        norm_json.write_text(
            json.dumps(packages, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        norm_db = output_root / "rfq_normalized.db"
        load_normalized_sqlite(packages, norm_db)
        for pkg in packages:
            s = pkg["summary"]
            log.info(
                "Normalized %s: %d attachments, %d documents, %d chunks",
                pkg["package_id"],
                s["attachment_count"],
                s["document_count"],
                s["chunk_count"],
            )
        log.info("Wrote %s and %s", norm_json, norm_db)

    return 0


if __name__ == "__main__":
    sys.exit(main())
