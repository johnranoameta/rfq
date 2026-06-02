"""Classify RFQ documents and attachments by role from filename heuristics."""

from __future__ import annotations

import re
from pathlib import Path

# (role, compiled regex) — first match wins
_ROLE_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("quote_acknowledgement", re.compile(r"quote\s*ackn", re.I)),
    ("team_feasibility", re.compile(r"team\s*feasibility", re.I)),
    ("technical_compliance", re.compile(r"technical\s*compliance", re.I)),
    ("supplier_request_form", re.compile(r"supplier\s*request\s*form", re.I)),
    ("cost_breakdown", re.compile(r"cost\s*breakdown", re.I)),
    ("quote_form_mx", re.compile(r"mx\s*form", re.I)),
    ("quote_form_il", re.compile(r"il\s*form", re.I)),
    ("quote_instructions_mx", re.compile(r"instructions.*mx|mx.*instructions", re.I)),
    ("quote_instructions_il", re.compile(r"instructions.*il|il.*instructions", re.I)),
    ("quality_requirements", re.compile(r"quality|1927-4", re.I)),
    ("supply_chain", re.compile(r"supply\s*chain", re.I)),
    ("tooling", re.compile(r"tooling|tool\s*review", re.I)),
    ("supplier_diversity", re.compile(r"diversity", re.I)),
    ("special_terms_gmna", re.compile(r"special\s*terms.*gmna|gmna.*special\s*terms", re.I)),
    ("special_terms_global", re.compile(r"global\s*special\s*terms", re.I)),
    ("advance_purchasing", re.compile(r"advance\s*purchasing", re.I)),
    ("business_requirements", re.compile(r"business\s*requirements", re.I)),
    ("tooling_guideline", re.compile(r"tooling\s*guideline", re.I)),
    ("esor", re.compile(r"esor", re.I)),
    ("lead_free", re.compile(r"lead\s*free", re.I)),
    ("standard_gmw", re.compile(r"gmw\d", re.I)),
    ("standard_gm1700", re.compile(r"gm\s*1700|gm1700", re.I)),
    ("standard_gm1927", re.compile(r"gm\s*1927|gm1927", re.I)),
    ("gpotc", re.compile(r"gpotc", re.I)),
    ("good_corporate_citizen", re.compile(r"good\s*corp|corporate\s*citizen", re.I)),
    ("math_capability", re.compile(r"math\s*capability", re.I)),
    ("directed_buy", re.compile(r"directed.?buy|rasic", re.I)),
    ("power_access", re.compile(r"power\s*access", re.I)),
    ("main_rfq", re.compile(r"rfq|global\s*program", re.I)),
]


def classify_role(name: str, *, depth: int = 0, file_type: str | None = None) -> str:
    """Return a stable role label for an RFQ document or attachment."""
    stem = Path(name).stem if name else ""
    if depth == 0 and file_type is None:
        return "main_rfq"

    for role, pattern in _ROLE_RULES:
        if pattern.search(stem) or pattern.search(name):
            return role

    if file_type == "pdf":
        return "pdf_attachment"
    if file_type == "excel":
        return "excel_attachment"
    if file_type == "word":
        return "word_attachment"
    return "other"
