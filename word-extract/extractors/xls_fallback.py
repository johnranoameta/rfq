"""Read legacy .xls without Excel COM (fallback when VBA/COM fails)."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _cell_value(val: Any) -> Any:
    if val is None or val == "":
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, datetime):
        return val.astimezone(timezone.utc).isoformat()
    return str(val)


def extract_workbook_xlrd(xls_path: Path) -> dict[str, Any]:
    import xlrd

    xls_path = xls_path.resolve()
    book = xlrd.open_workbook(str(xls_path), formatting_info=False)

    result: dict[str, Any] = {
        "source": str(xls_path),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "engine": "xlrd",
        "sheets": [],
    }

    for s_idx, sheet in enumerate(book.sheets(), start=1):
        values: list[list[Any]] = []
        for r in range(sheet.nrows):
            row: list[Any] = []
            for c in range(sheet.ncols):
                cell = sheet.cell(r, c)
                if cell.ctype == xlrd.XL_CELL_DATE:
                    dt = xlrd.xldate.xldate_as_datetime(cell.value, book.datemode)
                    row.append(dt.astimezone(timezone.utc).isoformat())
                else:
                    row.append(_cell_value(cell.value))
            values.append(row)

        result["sheets"].append(
            {
                "index": s_idx,
                "name": sheet.name,
                "rows": sheet.nrows,
                "columns": sheet.ncols,
                "values": values,
            }
        )

    return result
