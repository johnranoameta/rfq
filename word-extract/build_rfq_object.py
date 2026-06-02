#!/usr/bin/env py
"""Build curated RFQ objects (field + value + source document) from extraction + normalized data."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from extractors.rfq_object_builder import build_rfq_objects_from_manifest
from rfq_object_db import load_rfq_objects_sqlite


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Build RFQ object field tables with document provenance (baseline template)."
    )
    parser.add_argument(
        "--extraction",
        default="output/extraction.json",
        help="Path to extraction.json",
    )
    parser.add_argument(
        "--normalized",
        default="output/normalized.json",
        help="Path to normalized.json",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="output/rfq_objects.json",
        help="RFQ objects JSON output",
    )
    parser.add_argument(
        "-d",
        "--database",
        default="output/rfq_baseline.db",
        help="SQLite database (default: output/rfq_baseline.db)",
    )
    parser.add_argument(
        "--baseline-id",
        default=None,
        help="package_id to mark as baseline (default: first package)",
    )
    parser.add_argument(
        "--append-db",
        action="store_true",
        help="Append to DB instead of replacing",
    )
    args = parser.parse_args(argv)

    ext_path = Path(args.extraction).resolve()
    norm_path = Path(args.normalized).resolve()
    if not ext_path.is_file():
        print(f"Not found: {ext_path}", file=sys.stderr)
        return 1
    if not norm_path.is_file():
        print(f"Not found: {norm_path}", file=sys.stderr)
        return 1

    records = json.loads(ext_path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        records = [records]

    packages = json.loads(norm_path.read_text(encoding="utf-8"))
    if not isinstance(packages, list):
        packages = [packages]

    objects = build_rfq_objects_from_manifest(
        records,
        packages,
        baseline_package_id=args.baseline_id,
    )
    if not objects:
        print("No RFQ objects built (check package_id alignment).", file=sys.stderr)
        return 1

    out_json = Path(args.output).resolve()
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(
        json.dumps(objects, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    db_path = Path(args.database).resolve()
    load_rfq_objects_sqlite(objects, db_path, replace=not args.append_db)

    for obj in objects:
        flag = " [BASELINE]" if obj.get("is_baseline") else ""
        print(
            f"{obj['package_id']}{flag}: "
            f"{obj['filled_field_count']}/{obj['field_count']} fields with values"
        )
    print(f"Wrote {out_json}")
    print(f"Wrote {db_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
