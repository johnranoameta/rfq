import type { ParsedRfqWorkbook } from "@/lib/rfq/parseRfqWorkbook";

/**
 * Maps a 4-sheet workbook into the shared "parsed RFQ" object shape for matching + model-assisted gap analysis.
 * Includes `suppliers_grouped` so the model can reason per supplier across multiple line items.
 */
export function workbookToAgentParsed(w: ParsedRfqWorkbook): Record<string, unknown> {
  const h = w.header;
  const program = [h.region, h.sop].filter(Boolean).join(" · ") || h.rfq_id;

  const line_items = w.line_items.map((li, idx) => {
    const lineNo = Number.parseInt(String(li.item).replace(/\D/g, ""), 10) || idx + 1;
    const lineVol = li.annual_volume != null && li.annual_volume > 0 ? li.annual_volume : null;
    const headerVol = h.annual_volume > 0 ? h.annual_volume : null;
    return {
      line_no: lineNo,
      part_number: String(li.item).trim() || `L${idx + 1}`,
      part_name: li.part_name,
      material_grade: li.material,
      process: li.process,
      annual_volume: lineVol ?? headerVol,
      sop_date: h.sop || null,
      general_tolerance_mm: null,
      thickness_mm: li.thickness_mm,
      notes: [li.system, li.subsystem, li.level].filter(Boolean).join(" · ") || null,
      target_price: li.target_price,
      tooling_flag: li.tooling,
    };
  });

  const first = w.line_items[0];
  const spec_text =
    w.technical_specs.length > 0
      ? w.technical_specs.map((s) => `${s.part_name}: ${s.spec_text}`).join("\n")
      : null;

  return {
    source_form: "four_sheet_workbook",
    rfq_reference: h.rfq_id || null,
    issue_date: null,
    response_due_date: null,
    quote_valid_until: null,
    rfq_case: "workbook",
    document_completeness: "incomplete",
    customer: h.customer || null,
    program,
    part_name: first?.part_name ?? null,
    part_number: first ? String(first.item) : null,
    process_family: first?.process ? first.process.split(",").map((s) => s.trim()).filter(Boolean) : [],
    material_grade: first?.material ?? null,
    thickness_mm: first?.thickness_mm ?? null,
    annual_volume: h.annual_volume || null,
    sop_date: h.sop || null,
    general_tolerance_mm: null,
    ppap_level: null,
    incoterm: null,
    payment_terms: null,
    annual_reduction_pct: null,
    line_items,
    spec_text,
    workbook_header: {
      rfq_id: h.rfq_id,
      customer: h.customer,
      region: h.region,
      annual_volume: h.annual_volume,
      currency: h.currency,
      sop: h.sop,
    },
    technical_specs: w.technical_specs.map((s) => ({
      part_name: s.part_name,
      spec_text: s.spec_text,
    })),
    supplier_responses_flat: w.supplier_responses.map((r) => ({
      supplier: r.supplier,
      item: r.item,
      quoted_price: r.quoted_price,
      lead_time_weeks: r.lead_time_weeks,
      assumptions: r.assumptions,
      deviations: r.deviations,
    })),
    /** One supplier, many line items — primary structure for gap reasoning. */
    suppliers_grouped: w.suppliers_grouped.map((g) => ({
      supplier: g.supplier,
      line_count: g.quotes.length,
      items: g.quotes.map((q) => q.item),
      quotes: g.quotes.map((q) => ({
        item: q.item,
        quoted_price: q.quoted_price,
        lead_time_weeks: q.lead_time_weeks,
        assumptions: q.assumptions,
        deviations: q.deviations,
      })),
    })),
    required_attachments: [],
    missing_references: [],
  };
}
