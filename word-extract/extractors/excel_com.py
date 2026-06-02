"""Extract cell data from legacy .xls via Excel COM."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import win32com.client


def _cell_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, datetime):
        return val.astimezone(timezone.utc).isoformat()
    return str(val)


def _normalize_used_range(used: Any, values: Any) -> tuple[int, int, list[list[Any]]]:
    rows = used.Rows.Count
    cols = used.Columns.Count
    if values is None:
        return rows, cols, []
    if not isinstance(values, tuple):
        return rows, cols, [[_cell_value(values)]]
    if rows == 1 and cols == 1:
        return rows, cols, [[_cell_value(values)]]
    if rows == 1:
        return rows, cols, [[_cell_value(v) for v in values]]
    grid: list[list[Any]] = []
    for row in values:
        if isinstance(row, tuple):
            grid.append([_cell_value(v) for v in row])
        else:
            grid.append([_cell_value(row)])
    return rows, cols, grid


def extract_workbook(xls_path: Path, xl_app: Any | None = None) -> dict[str, Any]:
    """Return sheet names and used-range values for an .xls/.xlsx file."""
    xls_path = xls_path.resolve()
    own_session = xl_app is None
    xl = xl_app or win32com.client.Dispatch("Excel.Application")
    if own_session:
        try:
            xl.Visible = False
        except Exception:
            pass
        xl.DisplayAlerts = False

    result: dict[str, Any] = {
        "source": str(xls_path),
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "engine": "excel_com",
        "sheets": [],
    }

    try:
        wb = xl.Workbooks.Open(
            str(xls_path),
            ReadOnly=True,
            UpdateLinks=0,
            IgnoreReadOnlyRecommended=True,
        )
        try:
            for s_idx in range(1, wb.Sheets.Count + 1):
                sheet = wb.Sheets(s_idx)
                sheet_info: dict[str, Any] = {
                    "index": s_idx,
                    "name": sheet.Name,
                }
                try:
                    used = sheet.UsedRange
                    rows, cols, grid = _normalize_used_range(used, used.Value)
                    sheet_info["rows"] = rows
                    sheet_info["columns"] = cols
                    sheet_info["values"] = grid
                except Exception as exc:
                    sheet_info["error"] = str(exc)
                result["sheets"].append(sheet_info)
        finally:
            wb.Close(False)
    finally:
        if own_session:
            xl.Quit()

    return result
