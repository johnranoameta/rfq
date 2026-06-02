#!/usr/bin/env py
"""Load extraction.json into a SQLite database."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id       INTEGER REFERENCES documents(id),
    source_path     TEXT NOT NULL,
    filename        TEXT NOT NULL,
    depth           INTEGER NOT NULL DEFAULT 0,
    suffix          TEXT,
    engine          TEXT,
    extracted_at    TEXT,
    title           TEXT,
    author          TEXT,
    full_text       TEXT,
    full_text_path  TEXT,
    statistics_json TEXT,
    properties_json TEXT,
    error           TEXT
);

CREATE TABLE IF NOT EXISTS paragraphs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id     INTEGER NOT NULL REFERENCES documents(id),
    para_index      INTEGER NOT NULL,
    text            TEXT,
    style           TEXT,
    outline_level   TEXT
);

CREATE TABLE IF NOT EXISTS tables (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id     INTEGER NOT NULL REFERENCES documents(id),
    table_index     INTEGER NOT NULL,
    row_count       INTEGER,
    col_count       INTEGER
);

CREATE TABLE IF NOT EXISTS table_cells (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id        INTEGER NOT NULL REFERENCES tables(id),
    row_num         INTEGER NOT NULL,
    col_num         INTEGER NOT NULL,
    text            TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id     INTEGER NOT NULL REFERENCES documents(id),
    filename        TEXT NOT NULL,
    file_type       TEXT,
    file_path       TEXT,
    size_bytes      INTEGER,
    prog_id         TEXT,
    icon_label      TEXT,
    extraction_method TEXT,
    sha256          TEXT,
    structured_data_path TEXT,
    error           TEXT
);

CREATE TABLE IF NOT EXISTS pdf_content (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    attachment_id   INTEGER NOT NULL REFERENCES attachments(id),
    page_count      INTEGER,
    full_text       TEXT,
    metadata_json   TEXT
);

CREATE TABLE IF NOT EXISTS pdf_pages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    attachment_id   INTEGER NOT NULL REFERENCES attachments(id),
    page_num        INTEGER NOT NULL,
    text            TEXT,
    char_count      INTEGER
);

CREATE TABLE IF NOT EXISTS excel_sheets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    attachment_id   INTEGER NOT NULL REFERENCES attachments(id),
    sheet_index     INTEGER NOT NULL,
    name            TEXT,
    row_count       INTEGER,
    col_count       INTEGER,
    values_json     TEXT,
    engine          TEXT
);

CREATE TABLE IF NOT EXISTS hyperlinks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id     INTEGER NOT NULL REFERENCES documents(id),
    link_index      INTEGER,
    text            TEXT,
    address         TEXT,
    sub_address     TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_paragraphs_doc ON paragraphs(document_id);
CREATE INDEX IF NOT EXISTS idx_attachments_doc ON attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_pages_attachment ON pdf_pages(attachment_id);
"""


def _sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _title_author(record: dict[str, Any]) -> tuple[str | None, str | None]:
    props = record.get("properties") or {}
    built_in = props.get("built_in") or {}
    core = props.get("core") or {}
    title = built_in.get("Title") or core.get("title")
    author = built_in.get("Author") or core.get("author")
    return title, author


def _full_text(record: dict[str, Any]) -> str:
    parts = [p.get("text", "") for p in record.get("paragraphs") or [] if p.get("text")]
    return "\n".join(parts)


def _insert_document(
    conn: sqlite3.Connection,
    record: dict[str, Any],
    parent_id: int | None,
) -> int:
    source = record.get("source", "")
    path = Path(source)
    title, author = _title_author(record)
    stats = record.get("statistics")

    cur = conn.execute(
        """
        INSERT INTO documents (
            parent_id, source_path, filename, depth, suffix, engine, extracted_at,
            title, author, full_text, full_text_path, statistics_json, properties_json, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            parent_id,
            source,
            path.name,
            record.get("depth", 0),
            record.get("suffix"),
            record.get("engine"),
            record.get("extracted_at"),
            title,
            author,
            _full_text(record),
            record.get("full_text_export"),
            json.dumps(stats, ensure_ascii=False) if stats else None,
            json.dumps(record.get("properties"), ensure_ascii=False, default=str)
            if record.get("properties")
            else None,
            record.get("error"),
        ),
    )
    doc_id = cur.lastrowid
    assert doc_id is not None

    for para in record.get("paragraphs") or []:
        conn.execute(
            """
            INSERT INTO paragraphs (document_id, para_index, text, style, outline_level)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                doc_id,
                para.get("index"),
                para.get("text"),
                para.get("style"),
                str(para.get("outline_level")) if para.get("outline_level") is not None else None,
            ),
        )

    for table in record.get("tables") or []:
        tcur = conn.execute(
            """
            INSERT INTO tables (document_id, table_index, row_count, col_count)
            VALUES (?, ?, ?, ?)
            """,
            (doc_id, table.get("index"), table.get("rows"), table.get("columns")),
        )
        table_id = tcur.lastrowid
        for row in table.get("cells") or []:
            for cell in row:
                conn.execute(
                    """
                    INSERT INTO table_cells (table_id, row_num, col_num, text)
                    VALUES (?, ?, ?, ?)
                    """,
                    (table_id, cell.get("row"), cell.get("col"), cell.get("text")),
                )

    for link in record.get("hyperlinks") or []:
        conn.execute(
            """
            INSERT INTO hyperlinks (document_id, link_index, text, address, sub_address)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                doc_id,
                link.get("index"),
                link.get("text"),
                link.get("address"),
                link.get("sub_address"),
            ),
        )

    _insert_attachments(conn, doc_id, record)

    for child in record.get("children") or []:
        _insert_document(conn, child, doc_id)

    return doc_id


def _insert_attachments(conn: sqlite3.Connection, doc_id: int, record: dict[str, Any]) -> None:
    seen_paths: set[str] = set()

    def add_attachment(
        *,
        filename: str,
        file_type: str | None,
        file_path: str | None,
        size_bytes: int | None,
        prog_id: str | None = None,
        icon_label: str | None = None,
        method: str | None = None,
        structured_data_path: str | None = None,
        error: str | None = None,
        pdf_data: dict[str, Any] | None = None,
        excel_data: dict[str, Any] | None = None,
    ) -> None:
        if file_path:
            key = str(Path(file_path).resolve()).lower()
            if key in seen_paths:
                return
            seen_paths.add(key)

        digest = _sha256(Path(file_path)) if file_path and Path(file_path).exists() else None
        cur = conn.execute(
            """
            INSERT INTO attachments (
                document_id, filename, file_type, file_path, size_bytes,
                prog_id, icon_label, extraction_method, sha256,
                structured_data_path, error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                doc_id,
                filename,
                file_type,
                file_path,
                size_bytes,
                prog_id,
                icon_label,
                method,
                digest,
                structured_data_path,
                error,
            ),
        )
        att_id = cur.lastrowid
        assert att_id is not None

        if pdf_data:
            conn.execute(
                """
                INSERT INTO pdf_content (attachment_id, page_count, full_text, metadata_json)
                VALUES (?, ?, ?, ?)
                """,
                (
                    att_id,
                    pdf_data.get("page_count"),
                    pdf_data.get("full_text"),
                    json.dumps(pdf_data.get("metadata"), ensure_ascii=False)
                    if pdf_data.get("metadata")
                    else None,
                ),
            )
            for page in pdf_data.get("pages") or []:
                conn.execute(
                    """
                    INSERT INTO pdf_pages (attachment_id, page_num, text, char_count)
                    VALUES (?, ?, ?, ?)
                    """,
                    (att_id, page.get("page"), page.get("text"), page.get("char_count")),
                )

        if excel_data:
            for sheet in excel_data.get("sheets") or []:
                conn.execute(
                    """
                    INSERT INTO excel_sheets (
                        attachment_id, sheet_index, name, row_count, col_count, values_json, engine
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        att_id,
                        sheet.get("index"),
                        sheet.get("name"),
                        sheet.get("rows"),
                        sheet.get("columns"),
                        json.dumps(sheet.get("values"), ensure_ascii=False, default=str)
                        if sheet.get("values") is not None
                        else None,
                        excel_data.get("engine"),
                    ),
                )

    for item in record.get("object_pool_files") or []:
        pdf_data = item.get("pdf_text")
        excel_data = None
        if item.get("structured_data"):
            try:
                excel_data = json.loads(Path(item["structured_data"]).read_text(encoding="utf-8"))
            except Exception:
                excel_data = None
        add_attachment(
            filename=item.get("filename") or Path(item.get("path", "")).name,
            file_type=item.get("type"),
            file_path=item.get("path"),
            size_bytes=item.get("size_bytes"),
            method=item.get("extraction_method"),
            structured_data_path=item.get("structured_data"),
            error=item.get("structured_data_error"),
            pdf_data=pdf_data,
            excel_data=excel_data,
        )

    for shape in record.get("inline_shapes") or []:
        saved = shape.get("saved_file") or {}
        ole = shape.get("ole") or {}
        if saved.get("path"):
            add_attachment(
                filename=Path(saved["path"]).name,
                file_type="word",
                file_path=saved.get("path"),
                size_bytes=saved.get("size_bytes"),
                prog_id=ole.get("prog_id"),
                icon_label=ole.get("icon_label"),
                method=saved.get("method"),
                error=saved.get("error"),
            )


def load_json(conn: sqlite3.Connection, json_path: Path) -> int:
    records = json.loads(json_path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        records = [records]

    count = 0
    for record in records:
        _insert_document(conn, record, parent_id=None)
        count += 1
    conn.commit()
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Load extraction.json into SQLite.")
    parser.add_argument(
        "json_path",
        nargs="?",
        default="output/extraction.json",
        help="Path to extraction.json (default: output/extraction.json)",
    )
    parser.add_argument(
        "-d",
        "--database",
        default="output/rfq.db",
        help="SQLite database path (default: output/rfq.db)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing database before loading",
    )
    args = parser.parse_args(argv)

    json_path = Path(args.json_path).resolve()
    db_path = Path(args.database).resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    if args.reset and db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA)

    if not json_path.exists():
        print(f"JSON not found: {json_path}")
        return 1

    loaded = load_json(conn, json_path)
    conn.close()

    print(f"Loaded {loaded} root document(s) into {db_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
