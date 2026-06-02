#!/usr/bin/env py
"""Normalize extraction.json into a comparison-ready format and SQLite index."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

from extractors.normalize import normalize_manifest

NORMALIZED_SCHEMA = """
CREATE TABLE IF NOT EXISTS rfq_packages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id      TEXT NOT NULL UNIQUE,
    source_path     TEXT NOT NULL,
    filename        TEXT NOT NULL,
    rfq_number      TEXT,
    title           TEXT,
    author          TEXT,
    file_sha256     TEXT,
    normalized_at   TEXT,
    summary_json    TEXT
);

CREATE TABLE IF NOT EXISTS rfq_documents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id      INTEGER NOT NULL REFERENCES rfq_packages(id),
    source_path     TEXT NOT NULL,
    filename        TEXT NOT NULL,
    depth           INTEGER NOT NULL DEFAULT 0,
    document_role   TEXT NOT NULL,
    section_number  TEXT,
    section_title   TEXT,
    section_display TEXT,
    section_path    TEXT,
    title           TEXT,
    author          TEXT,
    clean_text      TEXT,
    char_count      INTEGER,
    token_estimate  INTEGER,
    statistics_json TEXT,
    error           TEXT
);

CREATE TABLE IF NOT EXISTS rfq_sections (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id      INTEGER NOT NULL REFERENCES rfq_packages(id),
    number          TEXT NOT NULL,
    title           TEXT NOT NULL,
    display         TEXT NOT NULL,
    path            TEXT,
    level           INTEGER,
    parent_number   TEXT,
    paragraph_index INTEGER,
    style           TEXT
);

CREATE TABLE IF NOT EXISTS rfq_attachments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id      INTEGER NOT NULL REFERENCES rfq_packages(id),
    filename        TEXT NOT NULL,
    file_type       TEXT,
    document_role   TEXT NOT NULL,
    section_number  TEXT,
    section_title   TEXT,
    section_display TEXT,
    section_path    TEXT,
    file_path       TEXT,
    sha256          TEXT,
    size_bytes      INTEGER,
    clean_text      TEXT,
    char_count      INTEGER,
    token_estimate  INTEGER,
    structured_data_path TEXT,
    pdf_text_path   TEXT,
    error           TEXT,
    UNIQUE(package_id, sha256)
);

CREATE TABLE IF NOT EXISTS rfq_chunks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id      INTEGER NOT NULL REFERENCES rfq_packages(id),
    source_kind     TEXT NOT NULL,
    source_filename TEXT NOT NULL,
    document_role   TEXT NOT NULL,
    section_number  TEXT,
    section_title   TEXT,
    section_display TEXT,
    section_path    TEXT,
    chunk_index     INTEGER NOT NULL,
    text            TEXT NOT NULL,
    char_count      INTEGER,
    token_estimate  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_documents_package ON rfq_documents(package_id);
CREATE INDEX IF NOT EXISTS idx_documents_role ON rfq_documents(document_role);
CREATE INDEX IF NOT EXISTS idx_documents_section ON rfq_documents(section_number);
CREATE INDEX IF NOT EXISTS idx_sections_package ON rfq_sections(package_id);
CREATE INDEX IF NOT EXISTS idx_attachments_package ON rfq_attachments(package_id);
CREATE INDEX IF NOT EXISTS idx_attachments_role ON rfq_attachments(document_role);
CREATE INDEX IF NOT EXISTS idx_attachments_section ON rfq_attachments(section_number);
CREATE INDEX IF NOT EXISTS idx_attachments_sha256 ON rfq_attachments(sha256);
CREATE INDEX IF NOT EXISTS idx_chunks_package ON rfq_chunks(package_id);
CREATE INDEX IF NOT EXISTS idx_chunks_role ON rfq_chunks(document_role);
CREATE INDEX IF NOT EXISTS idx_chunks_section ON rfq_chunks(section_number);

CREATE TABLE IF NOT EXISTS rfq_section_slots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id      INTEGER NOT NULL REFERENCES rfq_packages(id),
    section_number  TEXT NOT NULL,
    section_title   TEXT,
    section_display TEXT,
    section_path    TEXT,
    level           INTEGER,
    parent_number   TEXT,
    paragraph_index INTEGER,
    body_text       TEXT NOT NULL DEFAULT '',
    body_char_count INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL,
    slot_json       TEXT NOT NULL,
    UNIQUE(package_id, section_number)
);

CREATE INDEX IF NOT EXISTS idx_section_slots_package ON rfq_section_slots(package_id);
CREATE INDEX IF NOT EXISTS idx_section_slots_status ON rfq_section_slots(status);
"""


def load_normalized_sqlite(packages: list[dict], db_path: Path) -> None:
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(str(db_path))
    conn.executescript(NORMALIZED_SCHEMA)

    for pkg in packages:
        cur = conn.execute(
            """
            INSERT INTO rfq_packages (
                package_id, source_path, filename, rfq_number, title, author,
                file_sha256, normalized_at, summary_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pkg["package_id"],
                pkg["source_path"],
                pkg["filename"],
                pkg.get("rfq_number"),
                pkg.get("title"),
                pkg.get("author"),
                pkg.get("file_sha256"),
                pkg.get("normalized_at"),
                json.dumps(pkg.get("summary"), ensure_ascii=False),
            ),
        )
        pkg_row_id = cur.lastrowid

        for sec in pkg.get("sections") or []:
            conn.execute(
                """
                INSERT INTO rfq_sections (
                    package_id, number, title, display, path, level,
                    parent_number, paragraph_index, style
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pkg_row_id,
                    sec["number"],
                    sec["title"],
                    sec["display"],
                    sec.get("path"),
                    sec.get("level"),
                    sec.get("parent_number"),
                    sec.get("paragraph_index"),
                    sec.get("style"),
                ),
            )

        for doc in pkg.get("documents") or []:
            conn.execute(
                """
                INSERT INTO rfq_documents (
                    package_id, source_path, filename, depth, document_role,
                    section_number, section_title, section_display, section_path,
                    title, author, clean_text, char_count, token_estimate,
                    statistics_json, error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pkg_row_id,
                    doc["source_path"],
                    doc["filename"],
                    doc.get("depth", 0),
                    doc["document_role"],
                    doc.get("section_number"),
                    doc.get("section_title"),
                    doc.get("section_display"),
                    doc.get("section_path"),
                    doc.get("title"),
                    doc.get("author"),
                    doc.get("clean_text"),
                    doc.get("char_count"),
                    doc.get("token_estimate"),
                    json.dumps(doc.get("statistics"), ensure_ascii=False)
                    if doc.get("statistics")
                    else None,
                    doc.get("error"),
                ),
            )

        for att in pkg.get("attachments") or []:
            conn.execute(
                """
                INSERT OR IGNORE INTO rfq_attachments (
                    package_id, filename, file_type, document_role,
                    section_number, section_title, section_display, section_path,
                    file_path, sha256, size_bytes, clean_text, char_count, token_estimate,
                    structured_data_path, pdf_text_path, error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pkg_row_id,
                    att["filename"],
                    att.get("file_type"),
                    att["document_role"],
                    att.get("section_number"),
                    att.get("section_title"),
                    att.get("section_display"),
                    att.get("section_path"),
                    att.get("file_path"),
                    att.get("sha256"),
                    att.get("size_bytes"),
                    att.get("clean_text"),
                    len(att.get("clean_text") or ""),
                    (len(att.get("clean_text") or "") // 4) if att.get("clean_text") else 0,
                    att.get("structured_data_path"),
                    att.get("pdf_text_path"),
                    att.get("error"),
                ),
            )

        for chunk in pkg.get("chunks") or []:
            conn.execute(
                """
                INSERT INTO rfq_chunks (
                    package_id, source_kind, source_filename, document_role,
                    section_number, section_title, section_display, section_path,
                    chunk_index, text, char_count, token_estimate
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pkg_row_id,
                    chunk["source_kind"],
                    chunk["source_filename"],
                    chunk["document_role"],
                    chunk.get("section_number"),
                    chunk.get("section_title"),
                    chunk.get("section_display"),
                    chunk.get("section_path"),
                    chunk["chunk_index"],
                    chunk["text"],
                    chunk.get("char_count"),
                    chunk.get("token_estimate"),
                ),
            )

        for slot in pkg.get("section_slots") or []:
            conn.execute(
                """
                INSERT INTO rfq_section_slots (
                    package_id, section_number, section_title, section_display,
                    section_path, level, parent_number, paragraph_index,
                    body_text, body_char_count, status, slot_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pkg_row_id,
                    slot["section_number"],
                    slot.get("section_title"),
                    slot.get("section_display"),
                    slot.get("section_path"),
                    slot.get("level"),
                    slot.get("parent_number"),
                    slot.get("paragraph_index"),
                    slot.get("body_text") or "",
                    slot.get("body_char_count", 0),
                    slot.get("status") or "empty",
                    json.dumps(slot, ensure_ascii=False),
                ),
            )

    conn.commit()
    conn.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Normalize extraction.json for RFQ comparison and AI retrieval."
    )
    parser.add_argument(
        "json_path",
        nargs="?",
        default="output/extraction.json",
        help="Path to extraction.json (default: output/extraction.json)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="output/normalized.json",
        help="Normalized JSON output (default: output/normalized.json)",
    )
    parser.add_argument(
        "-d",
        "--database",
        default="output/rfq_normalized.db",
        help="Normalized SQLite database (default: output/rfq_normalized.db)",
    )
    args = parser.parse_args(argv)

    json_path = Path(args.json_path).resolve()
    if not json_path.is_file():
        print(f"Not found: {json_path}", file=sys.stderr)
        return 1

    records = json.loads(json_path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        records = [records]

    packages = normalize_manifest(records)

    out_json = Path(args.output).resolve()
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(
        json.dumps(packages, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    db_path = Path(args.database).resolve()
    load_normalized_sqlite(packages, db_path)

    for pkg in packages:
        s = pkg["summary"]
        print(
            f"{pkg['package_id']}: "
            f"{s['attachment_count']} attachments (unique {s['unique_attachment_hashes']}), "
            f"{s['document_count']} documents, {s['chunk_count']} chunks"
        )
    print(f"Wrote {out_json}")
    print(f"Wrote {db_path}")

    try:
        from build_rfq_object import main as build_objects_main

        build_objects_main(
            [
                "--extraction",
                str(json_path),
                "--normalized",
                str(out_json),
                "--database",
                str(out_json.parent / "rfq_baseline.db"),
                "--output",
                str(out_json.parent / "rfq_objects.json"),
            ]
        )
    except Exception as exc:
        print(f"Warning: RFQ object build skipped: {exc}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
