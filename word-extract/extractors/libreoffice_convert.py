"""Headless LibreOffice conversion for Linux / non-Windows hosts."""

from __future__ import annotations

import glob
import logging
import os
import shutil
import subprocess
from pathlib import Path

log = logging.getLogger("extract_rfq")

_SOFFICE_NAMES = ("soffice", "libreoffice", "lowriter")

# PM2/Node often has a minimal PATH; check common install locations directly.
_SOFFICE_ABSOLUTE = (
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/usr/local/bin/soffice",
    "/usr/lib/libreoffice/program/soffice",
    "/usr/lib64/libreoffice/program/soffice",
)


def _is_executable(path: str) -> bool:
    p = Path(path)
    return p.is_file() and os.access(p, os.X_OK)


def _discover_soffice_paths() -> list[str]:
    found: list[str] = []
    seen: set[str] = set()

    def add(path: str | None) -> None:
        if not path:
            return
        resolved = str(Path(path).resolve())
        if resolved in seen or not _is_executable(resolved):
            return
        seen.add(resolved)
        found.append(resolved)

    explicit = os.environ.get("RFQ_SOFFICE", "").strip()
    if explicit:
        add(explicit)

    for name in _SOFFICE_NAMES:
        add(shutil.which(name))

    for path in _SOFFICE_ABSOLUTE:
        add(path)

    for pattern in (
        "/usr/lib/libreoffice*/program/soffice",
        "/usr/lib64/libreoffice*/program/soffice",
    ):
        for match in sorted(glob.glob(pattern)):
            add(match)

    return found


def find_soffice() -> str:
    candidates = _discover_soffice_paths()
    if candidates:
        chosen = candidates[0]
        log.info("Using LibreOffice: %s", chosen)
        return chosen

    raise RuntimeError(
        "LibreOffice not found (need soffice). "
        "On Amazon Linux: sudo dnf install -y libreoffice-headless libreoffice-writer. "
        "Then: which soffice && soffice --version. "
        "If installed but the app cannot see it, add to rfq-ui/.env.local: "
        "RFQ_SOFFICE=/usr/lib/libreoffice/program/soffice"
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
