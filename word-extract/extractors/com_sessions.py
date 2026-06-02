"""Reusable Word/Excel COM sessions for batch extraction."""

from __future__ import annotations

from typing import Any

import pythoncom
import win32com.client


def _com_enter() -> bool:
    """Initialize COM on the current thread (required for Streamlit / threaded hosts)."""
    try:
        pythoncom.CoInitializeEx(pythoncom.COINIT_APARTMENTTHREADED)
        return True
    except pythoncom.com_error:
        # Already initialized on this thread
        return False


def _com_exit(initialized: bool) -> None:
    if not initialized:
        return
    try:
        pythoncom.CoUninitialize()
    except pythoncom.com_error:
        pass


class WordSession:
    """Keep one Word instance alive across many document opens."""

    def __init__(self) -> None:
        self.app: Any = None
        self._com_initialized = False

    def __enter__(self) -> WordSession:
        self._com_initialized = _com_enter()
        # DispatchEx = fresh instance (avoids hung shared Word from prior UI/COM runs)
        self.app = win32com.client.DispatchEx("Word.Application")
        try:
            self.app.Visible = False
        except Exception:
            pass
        self.app.DisplayAlerts = 0
        return self

    def __exit__(self, *args: object) -> None:
        if self.app is not None:
            try:
                self.app.Quit()
            except Exception:
                pass
            self.app = None
        _com_exit(self._com_initialized)


class ExcelSession:
    """Keep one Excel instance alive across many workbook opens."""

    def __init__(self) -> None:
        self.app: Any = None
        self._com_initialized = False

    def __enter__(self) -> ExcelSession:
        self._com_initialized = _com_enter()
        self.app = win32com.client.DispatchEx("Excel.Application")
        try:
            self.app.Visible = False
        except Exception:
            pass
        self.app.DisplayAlerts = False
        return self

    def __exit__(self, *args: object) -> None:
        if self.app is not None:
            try:
                self.app.Quit()
            except Exception:
                pass
            self.app = None
        _com_exit(self._com_initialized)
