"""Extract legacy .doc RFQ packages on Linux without Word COM."""

from __future__ import annotations

import logging
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

log = logging.getLogger("extract_rfq")


def extract_legacy_doc(doc_path: Path, output_dir: Path) -> dict[str, Any]:
    """
    Linux path for OLE .doc:
    - LibreOffice: .doc -> .docx for body text, tables, docx-package embeds
    - olefile: ObjectPool PDF payloads (no win32)
    """
    from extractors.docx_pure import extract_docx
    from extractors.libreoffice_convert import convert_to_docx
    from extractors.ole_binary import extract_object_pool

    doc_path = doc_path.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    record: dict[str, Any] = {
        "source": str(doc_path),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "engine": "libreoffice+python-docx+olefile",
        "platform": sys.platform,
    }

    pool_dir = output_dir / "embedded"
    try:
        record["object_pool_files"] = extract_object_pool(
            doc_path,
            pool_dir,
            inline_shapes=None,
        )
    except Exception as exc:
        log.warning("ObjectPool extraction failed: %s", exc)
        record["object_pool_error"] = str(exc)
        record["object_pool_files"] = []

    with tempfile.TemporaryDirectory(prefix="rfq-lo-") as tmp:
        work = Path(tmp)
        try:
            docx_path = convert_to_docx(doc_path, work)
            converted_dir = output_dir / "converted"
            converted_dir.mkdir(exist_ok=True)
            saved_docx = converted_dir / docx_path.name
            shutil.copy2(docx_path, saved_docx)
            record.update(extract_docx(saved_docx, output_dir))
            record["converted_docx"] = str(saved_docx)
        except Exception as exc:
            log.error("LibreOffice/docx extraction failed: %s", exc)
            record["error"] = str(exc)

    record["engine"] = "libreoffice+python-docx+olefile"
    record["extraction_note"] = (
        "Linux extraction: no Word COM. Embedded Excel/Word OLE objects may be "
        "incomplete; PDF ObjectPool extracts and docx conversion embeds are included."
    )
    return record
