"""Headless LibreOffice conversion for Linux / non-Windows hosts."""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path

log = logging.getLogger("extract_rfq")

_SOFFICE_CANDIDATES = (
    "soffice",
    "libreoffice",
    "lowriter",
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
)


def find_soffice() -> str:
    explicit = os.environ.get("RFQ_SOFFICE", "").strip()
    if explicit:
        return explicit
    for name in _SOFFICE_CANDIDATES:
        found = shutil.which(name)
        if found:
            return found
    raise RuntimeError(
        "LibreOffice not found (need soffice on PATH). "
        "On Amazon Linux: sudo dnf install -y libreoffice-headless. "
        "Or set RFQ_SOFFICE to the full path."
    )


def convert_document(
    src: Path,
    out_dir: Path,
    target_format: str,
    *,
    timeout_sec: int = 600,
) -> Path:
    """Convert src to target_format (e.g. docx, xlsx) inside out_dir."""
    src = src.resolve()
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    soffice = find_soffice()
    cmd = [
        soffice,
        "--headless",
        "--norestore",
        "--invisible",
        "--convert-to",
        target_format,
        "--outdir",
        str(out_dir),
        str(src),
    ]
    log.info("Running: %s", " ".join(cmd))
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout_sec,
        check=False,
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()[-1500:]
        raise RuntimeError(
            f"LibreOffice conversion failed ({proc.returncode}): {detail or 'no output'}"
        )

    ext = f".{target_format.split(':')[0]}"
    expected = out_dir / f"{src.stem}{ext}"
    if expected.exists():
        return expected

    produced = sorted(
        out_dir.glob(f"{src.stem}.*"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if produced:
        return produced[0]

    raise RuntimeError(f"LibreOffice did not produce {ext} for {src.name} in {out_dir}")


def convert_to_docx(doc_path: Path, work_dir: Path) -> Path:
    return convert_document(doc_path, work_dir, "docx")
