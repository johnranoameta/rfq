"""Build curated RFQ objects (field + value + source document) from extraction + normalized data."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from extractors.baseline_catalog import CATALOG_VERSION, FIELD_CATALOG

_PARA_TEXT = re.compile(r"^\s*text\s*:\s*(.+)$", re.I)
_RFQ_NUM = re.compile(r"RFQ\s*#?\s*(\d{7,})", re.I)
_DATE_LINE = re.compile(r"^DATE:\s*(.+)$", re.I)
_DUE_HEADER = re.compile(r"^QUOTATION DUE DATE", re.I)
_EMAIL = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")
_PHONE = re.compile(r"(?:Phone|phone):\s*([\d\s().-]+)")
_FAX = re.compile(r"(?:Fax|fax):\s*([\d\s().-]+)")


def _norm(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\r", "\n").split()).strip()


def _paragraph_lines(record: dict[str, Any]) -> list[tuple[int, str]]:
    lines: list[tuple[int, str]] = []
    for para in record.get("paragraphs") or []:
        idx = para.get("index")
        text = _norm(para.get("text")).replace("\f", "")
        if text:
            lines.append((int(idx) if idx is not None else len(lines), text))
    return lines


def _main_doc_name(record: dict[str, Any], norm: dict[str, Any]) -> str:
    from pathlib import Path

    if norm.get("filename"):
        return norm["filename"]
    if record.get("filename"):
        return record["filename"]
    src = record.get("source") or ""
    return Path(src).name if src else ""


def _row(
    *,
    field_key: str,
    field_name: str,
    category: str,
    value: str = "",
    source_document: str = "",
    source_document_role: str = "",
    source_section: str = "",
    source_location: str = "",
    extraction_method: str = "catalog",
    template_required: bool = False,
    description: str = "",
    sort_order: int = 0,
) -> dict[str, Any]:
    return {
        "field_key": field_key,
        "field_name": field_name,
        "category": category,
        "value": value,
        "source_document": source_document,
        "source_document_role": source_document_role,
        "source_section": source_section,
        "source_location": source_location,
        "extraction_method": extraction_method,
        "template_required": template_required,
        "description": description,
        "sort_order": sort_order,
    }


def _best_attachment_text(
    filename: str,
    norm: dict[str, Any],
) -> tuple[str, str, str]:
    """Return (text, source_path_label, role) from expected_files or documents."""
    for slot in norm.get("section_slots") or []:
        for ef in slot.get("expected_files") or []:
            if (ef.get("filename") or "").lower() == filename.lower() and ef.get("clean_text"):
                return (
                    ef["clean_text"],
                    ef.get("filename") or filename,
                    ef.get("document_role") or "",
                )
    for doc in norm.get("documents") or []:
        if (doc.get("filename") or "").lower() == filename.lower() and doc.get("clean_text"):
            return (
                doc["clean_text"],
                doc.get("filename") or filename,
                doc.get("document_role") or "",
            )
    for att in norm.get("attachments") or []:
        if (att.get("filename") or "").lower() == filename.lower() and att.get("clean_text"):
            return (
                att["clean_text"],
                att.get("filename") or filename,
                att.get("document_role") or "",
            )
    return "", filename, ""


def _extract_main_letter(record: dict[str, Any], main_doc: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    lines = _paragraph_lines(record)
    texts = [t for _, t in lines]

    comm = ""
    letter_date = ""
    due_date = ""
    buyer_entities = ""
    mandatory = ""
    confidentiality = ""
    alternatives = ""
    coordinator_name = ""
    coordinator_email = ""
    decline_addr = ""

    for i, text in enumerate(texts):
        m = _RFQ_NUM.search(text)
        if m and not comm:
            comm = m.group(1)
            rows.append(
                _row(
                    field_key="rfq.communication_number",
                    field_name="RFQ Communication Number",
                    category="identity",
                    value=comm,
                    source_document=main_doc,
                    source_document_role="main_rfq",
                    source_location=f"paragraph:{lines[i][0] if i < len(lines) else i}",
                    extraction_method="regex",
                    template_required=True,
                    sort_order=10,
                )
            )
        dm = _DATE_LINE.match(text)
        if dm and not letter_date:
            letter_date = dm.group(1).strip()
            rows.append(
                _row(
                    field_key="rfq.letter_date",
                    field_name="RFQ Letter Date",
                    category="schedule",
                    value=letter_date,
                    source_document=main_doc,
                    source_document_role="main_rfq",
                    source_location=f"paragraph:{lines[i][0] if i < len(lines) else i}",
                    extraction_method="regex",
                    template_required=True,
                    sort_order=20,
                )
            )
        if _DUE_HEADER.match(text) and i + 1 < len(texts):
            due_date = texts[i + 1].strip()
            rows.append(
                _row(
                    field_key="rfq.quotation_due_date",
                    field_name="Quotation Due Date",
                    category="schedule",
                    value=due_date,
                    source_document=main_doc,
                    source_document_role="main_rfq",
                    source_location=f"paragraph:{lines[i + 1][0] if i + 1 < len(lines) else i + 1}",
                    extraction_method="next_paragraph",
                    template_required=True,
                    sort_order=30,
                )
            )
        if "GMNA" in text and "GM Corporation" in text:
            buyer_entities = text
        if "mandatory" in text.lower() and "bid will not be considered" in text.lower():
            mandatory = text[:500]
        if "not to be shared" in text.lower() or "confidential" in text.lower():
            if len(text) > 40:
                confidentiality = text[:500]
        if "alternative designs" in text.lower():
            alternatives = text[:500]
        if "Michele DeRush" in text or "michele.derush" in text.lower():
            coordinator_name = "Michele DeRush"
            em = _EMAIL.search(text)
            if em:
                coordinator_email = em.group(0)
            ph = re.search(r"Phone:\s*([\d\s().-]+)", text, re.I)
            if ph:
                rows.append(
                    _row(
                        field_key="contact.rfq_coordinator_phone",
                        field_name="RFQ Coordinator Phone",
                        category="contacts",
                        value=_norm(ph.group(1)),
                        source_document=main_doc,
                        source_document_role="main_rfq",
                        source_location=f"paragraph:{lines[i][0] if i < len(lines) else i}",
                        extraction_method="regex",
                        template_required=True,
                        sort_order=200,
                    )
                )
            fx = re.search(r"Fax:\s*([\d\s().-]+)", text, re.I)
            if fx:
                rows.append(
                    _row(
                        field_key="contact.rfq_coordinator_fax",
                        field_name="RFQ Coordinator Fax",
                        category="contacts",
                        value=_norm(fx.group(1)),
                        source_document=main_doc,
                        source_document_role="main_rfq",
                        source_location=f"paragraph:{lines[i][0] if i < len(lines) else i}",
                        extraction_method="regex",
                        template_required=True,
                        sort_order=210,
                    )
                )
            if "Warren" in text:
                decline_addr = text[:400]

    # Part table — scan for GPS pattern block
    for i, text in enumerate(texts):
        if text == "GPS160334" or re.match(r"^GPS\d+$", text):
            gm_pn = text
            eng = texts[i + 1] if i + 1 < len(texts) else ""
            year = texts[i + 2] if i + 2 < len(texts) else ""
            vol = texts[i + 3] if i + 3 < len(texts) else ""
            prog = texts[i + 4] if i + 4 < len(texts) else ""
            desc = re.sub(r"^\d+", "", eng).strip() or eng
            eng_num = re.match(r"^(\d+)", eng)
            rows.extend(
                [
                    _row(
                        field_key="part.gm_part_number",
                        field_name="GM Part Number",
                        category="part",
                        value=gm_pn,
                        source_document=main_doc,
                        source_document_role="main_rfq",
                        source_location="table:Program, Parts, Volumes",
                        extraction_method="table_sequence",
                        template_required=True,
                        sort_order=100,
                    ),
                    _row(
                        field_key="part.engineering_part_number",
                        field_name="Engineering Part Number",
                        category="part",
                        value=eng_num.group(1) if eng_num else eng,
                        source_document=main_doc,
                        source_document_role="main_rfq",
                        source_location="table:Program, Parts, Volumes",
                        extraction_method="table_sequence",
                        template_required=True,
                        sort_order=101,
                    ),
                    _row(
                        field_key="part.description",
                        field_name="Part Description",
                        category="part",
                        value=desc,
                        source_document=main_doc,
                        source_document_role="main_rfq",
                        source_location="table:Program, Parts, Volumes",
                        extraction_method="table_sequence",
                        template_required=True,
                        sort_order=102,
                    ),
                    _row(
                        field_key="part.model_year",
                        field_name="Part Model Year",
                        category="part",
                        value=year,
                        source_document=main_doc,
                        source_document_role="main_rfq",
                        source_location="table:Program, Parts, Volumes",
                        extraction_method="table_sequence",
                        template_required=True,
                        sort_order=103,
                    ),
                    _row(
                        field_key="part.annual_volume",
                        field_name="Annual Volume",
                        category="part",
                        value=vol.replace(",", ""),
                        source_document=main_doc,
                        source_document_role="main_rfq",
                        source_location="table:Program, Parts, Volumes",
                        extraction_method="table_sequence",
                        template_required=True,
                        sort_order=104,
                    ),
                    _row(
                        field_key="part.program_name",
                        field_name="Vehicle Program",
                        category="part",
                        value=prog,
                        source_document=main_doc,
                        source_document_role="main_rfq",
                        source_location="table:Program, Parts, Volumes",
                        extraction_method="table_sequence",
                        template_required=True,
                        sort_order=105,
                    ),
                ]
            )
            break
        # Generic: header row then data
        if text.startswith("GPS") and len(text) > 5:
            gm_pn = text
            if i + 1 < len(texts):
                eng = texts[i + 1]
                m = re.match(r"^(\d+)(.+)$", eng.replace(" ", ""))
                if m:
                    rows.append(
                        _row(
                            field_key="part.gm_part_number",
                            field_name="GM Part Number",
                            category="part",
                            value=gm_pn,
                            source_document=main_doc,
                            source_document_role="main_rfq",
                            source_location="table:Program, Parts, Volumes",
                            extraction_method="table_sequence",
                            template_required=True,
                            sort_order=100,
                        )
                    )
                    rows.append(
                        _row(
                            field_key="part.engineering_part_number",
                            field_name="Engineering Part Number",
                            category="part",
                            value=m.group(1),
                            source_document=main_doc,
                            source_document_role="main_rfq",
                            source_location="table:Program, Parts, Volumes",
                            extraction_method="table_sequence",
                            template_required=True,
                            sort_order=101,
                        )
                    )
                    rows.append(
                        _row(
                            field_key="part.description",
                            field_name="Part Description",
                            category="part",
                            value=m.group(2).strip(),
                            source_document=main_doc,
                            source_document_role="main_rfq",
                            source_location="table:Program, Parts, Volumes",
                            extraction_method="table_sequence",
                            template_required=True,
                            sort_order=102,
                        )
                    )

    if buyer_entities:
        rows.append(
            _row(
                field_key="rfq.buyer_entities",
                field_name="Contracting Buyer Entities",
                category="identity",
                value=buyer_entities,
                source_document=main_doc,
                source_document_role="main_rfq",
                source_location="introduction",
                extraction_method="paragraph_scan",
                template_required=True,
                sort_order=40,
            )
        )
    if mandatory:
        rows.append(
            _row(
                field_key="process.mandatory_response_warning",
                field_name="Mandatory Response Policy",
                category="process",
                value=mandatory,
                source_document=main_doc,
                source_document_role="main_rfq",
                extraction_method="paragraph_scan",
                template_required=True,
                sort_order=150,
            )
        )
    if confidentiality:
        rows.append(
            _row(
                field_key="process.confidentiality_policy",
                field_name="Confidentiality Policy",
                category="process",
                value=confidentiality,
                source_document=main_doc,
                source_document_role="main_rfq",
                extraction_method="paragraph_scan",
                template_required=True,
                sort_order=160,
            )
        )
    if alternatives:
        rows.append(
            _row(
                field_key="process.alternatives_required",
                field_name="Alternative Designs Expected",
                category="process",
                value=alternatives,
                source_document=main_doc,
                source_document_role="main_rfq",
                extraction_method="paragraph_scan",
                sort_order=170,
            )
        )
    if coordinator_name:
        rows.append(
            _row(
                field_key="contact.rfq_coordinator_name",
                field_name="RFQ Coordinator Name",
                category="contacts",
                value=coordinator_name,
                source_document=main_doc,
                source_document_role="main_rfq",
                extraction_method="paragraph_scan",
                template_required=True,
                sort_order=180,
            )
        )
    if coordinator_email:
        rows.append(
            _row(
                field_key="contact.rfq_coordinator_email",
                field_name="RFQ Coordinator Email",
                category="contacts",
                value=coordinator_email,
                source_document=main_doc,
                source_document_role="main_rfq",
                extraction_method="regex",
                template_required=True,
                sort_order=190,
            )
        )
    if decline_addr:
        rows.append(
            _row(
                field_key="contact.decline_return_address",
                field_name="Decline / Return Address",
                category="contacts",
                value=decline_addr,
                source_document=main_doc,
                source_document_role="main_rfq",
                extraction_method="paragraph_scan",
                sort_order=220,
            )
        )

    rows.append(
        _row(
            field_key="process.technical_review_section",
            field_name="Technical Review Section",
            category="process",
            value="Section 1 — Technical Review Quotation Mandatory Response Forms",
            source_document=main_doc,
            source_document_role="main_rfq",
            source_location="section:1",
            extraction_method="structure",
            template_required=True,
            sort_order=130,
        )
    )
    rows.append(
        _row(
            field_key="process.post_technical_review_section",
            field_name="Post Technical Review Section",
            category="process",
            value="Section 2 — Post Technical Review Mandatory Response Forms",
            source_document=main_doc,
            source_document_role="main_rfq",
            source_location="section:2",
            extraction_method="structure",
            template_required=True,
            sort_order=140,
        )
    )

    return rows


def _extract_properties(record: dict[str, Any], norm: dict[str, Any], main_doc: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    props = record.get("properties") or {}
    built = props.get("built_in") or {}
    custom = props.get("custom") or {}

    title = built.get("Title") or ""
    author = built.get("Author") or ""
    company = built.get("Company") or ""

    if title:
        rows.append(
            _row(
                field_key="rfq.template_title",
                field_name="Template Title",
                category="identity",
                value=title,
                source_document=main_doc,
                source_document_role="main_rfq",
                source_location="properties.built_in.Title",
                extraction_method="metadata",
                template_required=True,
                sort_order=5,
            )
        )
        m = re.search(r"\(([^)]+)\)", title)
        if m:
            rows.append(
                _row(
                    field_key="rfq.template_version_date",
                    field_name="Template Version Date",
                    category="identity",
                    value=m.group(1).strip(),
                    source_document=main_doc,
                    source_document_role="main_rfq",
                    source_location="properties.built_in.Title",
                    extraction_method="metadata",
                    sort_order=6,
                )
            )

    if author:
        rows.append(
            _row(
                field_key="rfq.author",
                field_name="Document Author",
                category="identity",
                value=author,
                source_document=main_doc,
                source_document_role="main_rfq",
                source_location="properties.built_in.Author",
                extraction_method="metadata",
                sort_order=7,
            )
        )

    bu = _norm(custom.get("bu", "").replace(";#", " ").strip())
    region = _norm(custom.get("region", "").replace(";#", " ").strip())
    location = _norm(custom.get("BWLocation") or custom.get("bwlocation") or "")

    if bu:
        rows.append(
            _row(
                field_key="rfq.business_unit",
                field_name="Business Unit",
                category="identity",
                value=bu,
                source_document=main_doc,
                source_document_role="main_rfq",
                source_location="properties.custom.bu",
                extraction_method="metadata",
                sort_order=8,
            )
        )
    if region:
        rows.append(
            _row(
                field_key="rfq.region",
                field_name="Sourcing Region",
                category="identity",
                value=region,
                source_document=main_doc,
                source_document_role="main_rfq",
                source_location="properties.custom.region",
                extraction_method="metadata",
                sort_order=9,
            )
        )
    if location:
        rows.append(
            _row(
                field_key="rfq.location",
                field_name="Buyer Location",
                category="identity",
                value=location,
                source_document=main_doc,
                source_document_role="main_rfq",
                source_location="properties.custom.BWLocation",
                extraction_method="metadata",
                sort_order=9,
            )
        )

    pid = norm.get("package_id") or ""
    if pid:
        program_id = pid.split("-")[0] if "-" in pid else pid[:9]
        rows.append(
            _row(
                field_key="rfq.program_id",
                field_name="Program / Sourcing ID",
                category="identity",
                value=program_id,
                source_document=main_doc,
                source_document_role="main_rfq",
                source_location="package_id",
                extraction_method="filename",
                template_required=True,
                sort_order=1,
            )
        )
    rows.append(
        _row(
            field_key="rfq.package_filename",
            field_name="Package Filename",
            category="identity",
            value=main_doc,
            source_document=main_doc,
            source_document_role="main_rfq",
            source_location="filename",
            extraction_method="metadata",
            template_required=True,
            sort_order=2,
        )
    )

    return rows


def _extract_form_fields(norm: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    def from_doc(
        filename: str,
        role: str,
        section: str,
        specs: list[tuple[str, str, str, str]],
    ) -> None:
        text, src, r = _best_attachment_text(filename, norm)
        r = r or role
        for field_key, field_name, category, pattern in specs:
            value = ""
            if text and pattern:
                m = re.search(pattern, text, re.I | re.M)
                if m:
                    value = m.group(1).strip() if m.lastindex else m.group(0).strip()
            rows.append(
                _row(
                    field_key=field_key,
                    field_name=field_name,
                    category=category,
                    value=value,
                    source_document=src or filename,
                    source_document_role=r,
                    source_section=section,
                    source_location=f"form:{filename}",
                    extraction_method="form_template" if not value else "form_parse",
                    template_required=True,
                    sort_order=300,
                )
            )

    from_doc(
        "Quote Ackn_2800531647.doc",
        "quote_acknowledgement",
        "0.1",
        [
            ("form.quote_ack.company_name", "Company Name", "form.quote_ack", r"Company\t"),
            ("form.quote_ack.duns", "DUNS Number", "form.quote_ack", r"Duns#\t"),
            ("form.quote_ack.sales_contact_name", "Sales Contact Name", "form.quote_ack", r"Contact Name:\s*"),
            ("form.quote_ack.sales_contact_email", "Sales Contact Email", "form.quote_ack", r"eMail:\s*"),
            ("form.quote_ack.sales_contact_phone", "Sales Contact Phone", "form.quote_ack", r"Phone:\s*"),
        ],
    )

    # Commodity from quote ack
    text, src, _ = _best_attachment_text("Quote Ackn_2800531647.doc", norm)
    if text:
        m = re.search(r"RFQ #\(s\)(\d+)\s*[–-]\s*(.+)", text)
        if m:
            rows.append(
                _row(
                    field_key="rfq.commodity_description",
                    field_name="Commodity / Package Description",
                    category="identity",
                    value=_norm(m.group(2)),
                    source_document=src,
                    source_document_role="quote_acknowledgement",
                    source_section="0.1",
                    source_location="Quote Ackn body",
                    extraction_method="regex",
                    sort_order=11,
                )
            )
        if "within 5 days" in text.lower():
            rows.append(
                _row(
                    field_key="process.quote_ack_due_days",
                    field_name="Quote Acknowledgement Due (Days)",
                    category="process",
                    value="5",
                    source_document=src,
                    source_document_role="quote_acknowledgement",
                    source_section="0.1",
                    extraction_method="regex",
                    template_required=True,
                    sort_order=125,
                )
            )

    from_doc(
        "Supplier Request Form.doc",
        "supplier_request_form",
        "1.3",
        [
            ("form.supplier_request.supplier_name", "Supplier Name", "form.supplier_request",
             r"Supplier Name:\s*[_\s]*([^\n]+)"),
            ("form.supplier_request.header_duns", "Header DUNS", "form.supplier_request", r"Header DUNS"),
            ("form.supplier_request.manufacturing_duns", "Manufacturing DUNS", "form.supplier_request",
             r"Manufacturing\s+DUNS"),
            ("form.supplier_request.currency", "Quote Currency", "form.supplier_request", r"Currency"),
        ],
    )

    from_doc(
        "Development and Vendor Tooling Information .doc",
        "tooling",
        "2",
        [
            ("form.tooling.cad_system", "CAD System", "form.tooling", r"CAD-System:"),
            ("form.tooling.ug_required", "Unigraphics Required", "form.tooling", r"Uni graphics|Unigraphics"),
            ("form.tooling.production_tooling_lead_time_weeks", "Production Tooling Lead Time (Weeks)",
             "form.tooling", r"Production Tooling Lead Time \(in weeks\):"),
        ],
    )

    rows.append(
        _row(
            field_key="form.cost_breakdown.form_ids",
            field_name="Cost Breakdown Form IDs",
            category="form.cost",
            value="1804 / 1810",
            source_document="Cost Breakdown 1804 1810_2800531647.xls",
            source_document_role="cost_breakdown",
            source_section="1.4",
            source_location="section heading",
            extraction_method="structure",
            template_required=True,
            sort_order=310,
        )
    )

    rows.append(
        _row(
            field_key="access.supplypower_required",
            field_name="GM SupplyPower Registration Required",
            category="access",
            value="Yes",
            source_document="GM Supply Power Access.pdf",
            source_document_role="power_access",
            source_section="0.2",
            extraction_method="document_presence",
            template_required=True,
            sort_order=250,
        )
    )
    rows.append(
        _row(
            field_key="access.supplypower_url",
            field_name="GM SupplyPower URL",
            category="access",
            value="https://www.gmsupplypower.com",
            source_document="GM Supply Power Access.pdf",
            source_document_role="power_access",
            source_section="0.2",
            extraction_method="known_standard",
            template_required=True,
            sort_order=251,
        )
    )

    return rows


def _extract_attachment_registry(norm: dict[str, Any], main_doc: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    order = 400
    seen: set[str] = set()

    for att in norm.get("attachments") or []:
        fn = att.get("filename") or ""
        key = (att.get("sha256") or fn).lower()
        if key in seen:
            continue
        seen.add(key)

        sec = att.get("section_number") or ""
        role = att.get("document_role") or ""
        ft = att.get("file_type") or ""
        present = "yes" if fn else "no"
        text_len = len(att.get("clean_text") or "")
        for doc in norm.get("documents") or []:
            if (doc.get("filename") or "").lower() == fn.lower() and doc.get("clean_text"):
                text_len = max(text_len, len(doc["clean_text"]))
                break

        field_key = f"registry.attachment.{sec}.{role}" if sec else f"registry.attachment.{role}"
        # make unique
        base = field_key
        n = 0
        while field_key in {r["field_key"] for r in rows}:
            n += 1
            field_key = f"{base}.{n}"

        rows.append(
            _row(
                field_key=field_key,
                field_name=f"Attachment — {fn}",
                category="attachment",
                value=fn,
                source_document=main_doc,
                source_document_role="main_rfq",
                source_section=sec,
                source_location=f"embedded:{fn}",
                extraction_method="attachment_registry",
                description=f"type={ft}; role={role}; text_chars={text_len}; present={present}",
                sort_order=order,
            )
        )
        order += 1

    return rows


def _extract_section_requirements(norm: dict[str, Any], main_doc: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    order = 500
    for slot in norm.get("section_slots") or []:
        sec = slot.get("section_number") or ""
        title = slot.get("section_title") or ""
        for ef in slot.get("expected_files") or []:
            label = ef.get("icon_label") or ef.get("filename") or ""
            fn = ef.get("filename") or label
            present = "present" if ef.get("present") else "missing"
            safe = re.sub(r"[^a-zA-Z0-9]+", "_", fn)[:60].strip("_") or "file"
            rows.append(
                _row(
                    field_key=f"requirement.section.{sec}.{safe}",
                    field_name=f"Section {sec} Required File",
                    category="requirement",
                    value=fn,
                    source_document=main_doc,
                    source_document_role="main_rfq",
                    source_section=sec,
                    source_location=f"icon:{label}",
                    extraction_method="section_mapping",
                    description=f"{title} | status={present} | role={ef.get('document_role')}",
                    template_required=bool(ef.get("expected")),
                    sort_order=order,
                )
            )
            order += 1
    return rows


def _merge_catalog_placeholders(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ensure every catalog field exists at least once (blank if not extracted)."""
    by_key = {r["field_key"]: r for r in rows}
    out = list(rows)
    order = 9000
    for spec in FIELD_CATALOG:
        key = spec["field_key"]
        if key in by_key:
            existing = by_key[key]
            if not existing.get("description"):
                existing["description"] = spec["description"]
            if spec["template_required"]:
                existing["template_required"] = True
            continue
        out.append(
            _row(
                field_key=key,
                field_name=spec["field_name"],
                category=spec["category"],
                value="",
                source_document="",
                source_document_role="",
                source_location="catalog_placeholder",
                extraction_method="catalog_placeholder",
                template_required=spec["template_required"],
                description=spec["description"],
                sort_order=order,
            )
        )
        order += 1
    out.sort(key=lambda r: (r.get("category", ""), r.get("sort_order", 0), r.get("field_key", "")))
    return out


def build_rfq_object(
    record: dict[str, Any],
    norm: dict[str, Any],
    *,
    is_baseline: bool = False,
) -> dict[str, Any]:
    """Build one RFQ object with fields[] and provenance."""
    from pathlib import Path

    main_doc = norm.get("filename") or Path(record.get("source", "")).name

    rows: list[dict[str, Any]] = []
    rows.extend(_extract_properties(record, norm, main_doc))
    rows.extend(_extract_main_letter(record, main_doc))
    rows.extend(_extract_form_fields(norm))
    rows.extend(_extract_attachment_registry(norm, main_doc))
    rows.extend(_extract_section_requirements(norm, main_doc))
    rows = _merge_catalog_placeholders(rows)

    filled = sum(1 for r in rows if _norm(r.get("value")))
    return {
        "package_id": norm.get("package_id"),
        "source_path": norm.get("source_path") or record.get("source"),
        "filename": main_doc,
        "rfq_number": norm.get("rfq_number"),
        "title": norm.get("title"),
        "is_baseline": is_baseline,
        "catalog_version": CATALOG_VERSION,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "field_count": len(rows),
        "filled_field_count": filled,
        "summary": {
            "categories": sorted({r["category"] for r in rows}),
            "attachment_registry_count": sum(1 for r in rows if r["category"] == "attachment"),
            "requirement_count": sum(1 for r in rows if r["category"] == "requirement"),
        },
        "fields": rows,
    }


def build_rfq_objects_from_manifest(
    records: list[dict[str, Any]],
    normalized_packages: list[dict[str, Any]],
    *,
    baseline_package_id: str | None = None,
) -> list[dict[str, Any]]:
    norm_by_id = {p["package_id"]: p for p in normalized_packages}
    baseline_id = baseline_package_id or (
        normalized_packages[0]["package_id"] if normalized_packages else None
    )
    objects: list[dict[str, Any]] = []
    for rec in records:
        src = rec.get("source") or ""
        from pathlib import Path
        stem = Path(src).stem
        norm = norm_by_id.get(stem)
        if not norm:
            for pkg in normalized_packages:
                if pkg.get("filename") and stem in (pkg.get("source_path") or ""):
                    norm = pkg
                    break
        if not norm:
            continue
        is_base = norm["package_id"] == baseline_id
        objects.append(build_rfq_object(rec, norm, is_baseline=is_base))
    return objects
