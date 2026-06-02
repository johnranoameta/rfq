"""Canonical field catalog for GM global program RFQ baseline objects."""

from __future__ import annotations

from typing import TypedDict


class CatalogField(TypedDict):
    field_key: str
    field_name: str
    category: str
    description: str
    template_required: bool


CATALOG_VERSION = "1.0.0"

# Curated keys — extend this list as you refine the baseline template.
FIELD_CATALOG: list[CatalogField] = [
    # --- identity ---
    {"field_key": "rfq.program_id", "field_name": "Program / Sourcing ID", "category": "identity",
     "description": "Numeric program id from package filename prefix.", "template_required": True},
    {"field_key": "rfq.communication_number", "field_name": "RFQ Communication Number", "category": "identity",
     "description": "RFQ # in letter body (e.g. 2800531647).", "template_required": True},
    {"field_key": "rfq.package_filename", "field_name": "Package Filename", "category": "identity",
     "description": "Outer Word package file name.", "template_required": True},
    {"field_key": "rfq.template_title", "field_name": "Template Title", "category": "identity",
     "description": "Word document title property.", "template_required": True},
    {"field_key": "rfq.template_version_date", "field_name": "Template Version Date", "category": "identity",
     "description": "Global program RFQ template date in title.", "template_required": False},
    {"field_key": "rfq.letter_date", "field_name": "RFQ Letter Date", "category": "schedule",
     "description": "Date on cover letter.", "template_required": True},
    {"field_key": "rfq.quotation_due_date", "field_name": "Quotation Due Date", "category": "schedule",
     "description": "Mandatory quote submission deadline.", "template_required": True},
    {"field_key": "rfq.business_unit", "field_name": "Business Unit", "category": "identity",
     "description": "SharePoint/custom BU field.", "template_required": False},
    {"field_key": "rfq.region", "field_name": "Sourcing Region", "category": "identity",
     "description": "Region metadata on package.", "template_required": False},
    {"field_key": "rfq.location", "field_name": "Buyer Location", "category": "identity",
     "description": "BWLocation / buyer site.", "template_required": False},
    {"field_key": "rfq.author", "field_name": "Document Author", "category": "identity",
     "description": "Word author metadata.", "template_required": False},
    {"field_key": "rfq.buyer_entities", "field_name": "Contracting Buyer Entities", "category": "identity",
     "description": "GM legal entities named in introduction.", "template_required": True},
    {"field_key": "rfq.commodity_description", "field_name": "Commodity / Package Description", "category": "identity",
     "description": "e.g. Purchased Powertrain from quote acknowledgement.", "template_required": False},
    # --- part ---
    {"field_key": "part.gm_part_number", "field_name": "GM Part Number", "category": "part",
     "description": "Part number in Program/Parts/Volumes table.", "template_required": True},
    {"field_key": "part.engineering_part_number", "field_name": "Engineering Part Number", "category": "part",
     "description": "Engineering/drawing part id.", "template_required": True},
    {"field_key": "part.description", "field_name": "Part Description", "category": "part",
     "description": "Part name/description.", "template_required": True},
    {"field_key": "part.model_year", "field_name": "Part Model Year", "category": "part",
     "description": "Model year column.", "template_required": True},
    {"field_key": "part.annual_volume", "field_name": "Annual Volume", "category": "part",
     "description": "Annual volume column.", "template_required": True},
    {"field_key": "part.program_name", "field_name": "Vehicle Program", "category": "part",
     "description": "Program name column.", "template_required": True},
    # --- process ---
    {"field_key": "process.quote_ack_due_days", "field_name": "Quote Acknowledgement Due (Days)", "category": "process",
     "description": "Days to return quote acknowledgement.", "template_required": True},
    {"field_key": "process.technical_review_section", "field_name": "Technical Review Section", "category": "process",
     "description": "Section 1 forms due at technical review.", "template_required": True},
    {"field_key": "process.post_technical_review_section", "field_name": "Post Technical Review Section", "category": "process",
     "description": "Section 2 forms after concept selection.", "template_required": True},
    {"field_key": "process.mandatory_response_warning", "field_name": "Mandatory Response Policy", "category": "process",
     "description": "Bid not considered if mandatory info missing.", "template_required": True},
    {"field_key": "process.confidentiality_policy", "field_name": "Confidentiality Policy", "category": "process",
     "description": "RFQ not to be shared without authorization.", "template_required": True},
    {"field_key": "process.alternatives_required", "field_name": "Alternative Designs Expected", "category": "process",
     "description": "Supplier should propose weight/cost alternatives.", "template_required": False},
    # --- contacts ---
    {"field_key": "contact.rfq_coordinator_name", "field_name": "RFQ Coordinator Name", "category": "contacts",
     "description": "Quote acknowledgement coordinator.", "template_required": True},
    {"field_key": "contact.rfq_coordinator_email", "field_name": "RFQ Coordinator Email", "category": "contacts",
     "description": "Primary RFQ email.", "template_required": True},
    {"field_key": "contact.rfq_coordinator_phone", "field_name": "RFQ Coordinator Phone", "category": "contacts",
     "description": "Coordinator phone.", "template_required": True},
    {"field_key": "contact.rfq_coordinator_fax", "field_name": "RFQ Coordinator Fax", "category": "contacts",
     "description": "Coordinator fax.", "template_required": True},
    {"field_key": "contact.decline_return_address", "field_name": "Decline / Return Address", "category": "contacts",
     "description": "Where to return package if not quoting.", "template_required": False},
    # --- supplypower ---
    {"field_key": "access.supplypower_required", "field_name": "GM SupplyPower Registration Required", "category": "access",
     "description": "Section 0.2 access instructions.", "template_required": True},
    {"field_key": "access.supplypower_url", "field_name": "GM SupplyPower URL", "category": "access",
     "description": "Portal URL for documents.", "template_required": True},
    # --- quote ack form (template slots) ---
    {"field_key": "form.quote_ack.company_name", "field_name": "Company Name", "category": "form.quote_ack",
     "description": "Quote Acknowledgement Form.", "template_required": True},
    {"field_key": "form.quote_ack.supplier_signature", "field_name": "Supplier Signature", "category": "form.quote_ack",
     "description": "Quote Acknowledgement Form.", "template_required": True},
    {"field_key": "form.quote_ack.duns", "field_name": "DUNS Number", "category": "form.quote_ack",
     "description": "Quote Acknowledgement Form.", "template_required": True},
    {"field_key": "form.quote_ack.sales_contact_name", "field_name": "Sales Contact Name", "category": "form.quote_ack",
     "description": "Responsible sales person.", "template_required": True},
    {"field_key": "form.quote_ack.sales_contact_email", "field_name": "Sales Contact Email", "category": "form.quote_ack",
     "description": "Responsible sales person.", "template_required": True},
    {"field_key": "form.quote_ack.sales_contact_phone", "field_name": "Sales Contact Phone", "category": "form.quote_ack",
     "description": "Responsible sales person.", "template_required": True},
    {"field_key": "form.quote_ack.will_submit_proposal", "field_name": "Will Submit Proposal", "category": "form.quote_ack",
     "description": "Intent to quote checkbox.", "template_required": True},
    # --- supplier request ---
    {"field_key": "form.supplier_request.supplier_name", "field_name": "Supplier Name", "category": "form.supplier_request",
     "description": "Supplier Request Form 1.3.", "template_required": True},
    {"field_key": "form.supplier_request.header_duns", "field_name": "Header DUNS", "category": "form.supplier_request",
     "description": "Supplier Request Form.", "template_required": True},
    {"field_key": "form.supplier_request.manufacturing_duns", "field_name": "Manufacturing DUNS", "category": "form.supplier_request",
     "description": "Supplier Request Form.", "template_required": True},
    {"field_key": "form.supplier_request.currency", "field_name": "Quote Currency", "category": "form.supplier_request",
     "description": "Supplier Request Form.", "template_required": True},
    # --- cost / tooling forms ---
    {"field_key": "form.cost_breakdown.form_ids", "field_name": "Cost Breakdown Form IDs", "category": "form.cost",
     "description": "GM forms 1804/1810.", "template_required": True},
    {"field_key": "form.tooling.cad_system", "field_name": "CAD System", "category": "form.tooling",
     "description": "Development and Vendor Tooling Information.", "template_required": True},
    {"field_key": "form.tooling.ug_required", "field_name": "Unigraphics Required", "category": "form.tooling",
     "description": "GM requires UG.", "template_required": True},
    {"field_key": "form.tooling.production_tooling_lead_time_weeks", "field_name": "Production Tooling Lead Time (Weeks)",
     "category": "form.tooling", "description": "Section 2 tooling form.", "template_required": True},
]

# Dynamic attachment registry keys use prefix registry.attachment.*
# Section requirement keys use prefix requirement.section.*
