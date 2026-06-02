"""SQLite persistence for curated RFQ objects (baseline template)."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

RFQ_OBJECT_SCHEMA = """
CREATE TABLE IF NOT EXISTS rfq_object_packages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id          TEXT NOT NULL UNIQUE,
    source_path         TEXT,
    filename            TEXT NOT NULL,
    rfq_number          TEXT,
    title               TEXT,
    is_baseline         INTEGER NOT NULL DEFAULT 0,
    catalog_version     TEXT NOT NULL,
    built_at            TEXT NOT NULL,
    field_count         INTEGER NOT NULL DEFAULT 0,
    filled_field_count  INTEGER NOT NULL DEFAULT 0,
    summary_json        TEXT
);

CREATE TABLE IF NOT EXISTS rfq_object_fields (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id          INTEGER NOT NULL REFERENCES rfq_object_packages(id) ON DELETE CASCADE,
    field_key           TEXT NOT NULL,
    field_name          TEXT NOT NULL,
    category            TEXT NOT NULL,
    value               TEXT NOT NULL DEFAULT '',
    source_document     TEXT NOT NULL DEFAULT '',
    source_document_role TEXT NOT NULL DEFAULT '',
    source_section      TEXT NOT NULL DEFAULT '',
    source_location     TEXT NOT NULL DEFAULT '',
    extraction_method   TEXT NOT NULL DEFAULT '',
    template_required   INTEGER NOT NULL DEFAULT 0,
    description         TEXT NOT NULL DEFAULT '',
    sort_order          INTEGER NOT NULL DEFAULT 0,
    UNIQUE(package_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_object_fields_package ON rfq_object_fields(package_id);
CREATE INDEX IF NOT EXISTS idx_object_fields_category ON rfq_object_fields(category);
CREATE INDEX IF NOT EXISTS idx_object_fields_key ON rfq_object_fields(field_key);
CREATE INDEX IF NOT EXISTS idx_object_packages_baseline ON rfq_object_packages(is_baseline);
"""


def load_rfq_objects_sqlite(objects: list[dict], db_path: Path, *, replace: bool = True) -> None:
    if replace and db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.executescript(RFQ_OBJECT_SCHEMA)

    for obj in objects:
        cur = conn.execute(
            """
            INSERT INTO rfq_object_packages (
                package_id, source_path, filename, rfq_number, title,
                is_baseline, catalog_version, built_at,
                field_count, filled_field_count, summary_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                obj["package_id"],
                obj.get("source_path"),
                obj.get("filename"),
                obj.get("rfq_number"),
                obj.get("title"),
                1 if obj.get("is_baseline") else 0,
                obj.get("catalog_version"),
                obj.get("built_at"),
                obj.get("field_count", 0),
                obj.get("filled_field_count", 0),
                json.dumps(obj.get("summary"), ensure_ascii=False),
            ),
        )
        pkg_row_id = cur.lastrowid
        for field in obj.get("fields") or []:
            conn.execute(
                """
                INSERT INTO rfq_object_fields (
                    package_id, field_key, field_name, category, value,
                    source_document, source_document_role, source_section,
                    source_location, extraction_method, template_required,
                    description, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pkg_row_id,
                    field["field_key"],
                    field["field_name"],
                    field["category"],
                    field.get("value") or "",
                    field.get("source_document") or "",
                    field.get("source_document_role") or "",
                    field.get("source_section") or "",
                    field.get("source_location") or "",
                    field.get("extraction_method") or "",
                    1 if field.get("template_required") else 0,
                    field.get("description") or "",
                    field.get("sort_order", 0),
                ),
            )

    conn.commit()
    conn.close()
