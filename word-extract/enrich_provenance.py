"""Re-apply provenance to an existing extraction.json without re-extracting."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from extractors.provenance import enrich_record


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Add provenance to existing extraction.json")
    parser.add_argument(
        "path",
        nargs="?",
        default="output/extraction.json",
        help="Path to extraction.json",
    )
    args = parser.parse_args(argv)

    manifest_path = Path(args.path).resolve()
    if not manifest_path.is_file():
        print(f"Not found: {manifest_path}", file=sys.stderr)
        return 1

    output_root = manifest_path.parent
    records = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        records = [records]

    for rec in records:
        if rec.get("error"):
            continue
        pkg_dir = output_root / Path(rec["source"]).stem
        enrich_record(rec, output_dir=str(pkg_dir))
        (pkg_dir / "package.json").write_text(
            json.dumps(rec, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    manifest_path.write_text(
        json.dumps(records, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    print(f"Updated {manifest_path} ({len(records)} package(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
