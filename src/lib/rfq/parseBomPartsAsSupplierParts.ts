import { parseBomPartsWorkbook } from "@/lib/rfq/parseBomPartsWorkbook";
import type { ParsedSupplierPartRow } from "@/lib/rfq/parseSupplierPartsWorkbook";

/**
 * Adapts a BOM-parts-shaped workbook (README/suppliers/parts — e.g.
 * docs/sample_supplier_and_part_data.xlsx) into Supplier & Part DB rows, so the same
 * file can be bulk-uploaded there directly rather than requiring a separate flat
 * part_number/supplier_id/unit_cost table. Reuses parseBomPartsWorkbook.ts's existing
 * "parts" sheet parsing (including mfr_part_number extraction from
 * extended_attributes_json) rather than re-parsing the sheet independently.
 *
 * Only rows with a manufacturer part number, a supplier id, and a unit cost become a
 * supplier_parts record — those three fields are exactly what supplier_parts requires
 * (part_number, supplier_id are NOT NULL; a price-less row has nothing to look up).
 * Rows missing any of the three are counted as skipped, same convention as the other
 * workbook parsers in this module.
 */
export function parseBomPartsWorkbookAsSupplierParts(buffer: Buffer): {
  rows: ParsedSupplierPartRow[];
  skipped: number;
} {
  const { rows: bomRows, skipped: skippedByParts } = parseBomPartsWorkbook(buffer);

  const rows: ParsedSupplierPartRow[] = [];
  let skipped = skippedByParts;
  for (const r of bomRows) {
    if (!r.mfr_part_number || !r.supplier_id || r.unit_cost == null) {
      skipped++;
      continue;
    }
    rows.push({
      part_number: r.mfr_part_number,
      supplier_id: r.supplier_id,
      source: r.supplier_id,
      currency: r.currency,
      unit_cost: r.unit_cost,
      price_breaks_json: null,
      quote_date: null,
      fetched_at: null,
      lead_time: null,
      approval_status: null,
    });
  }

  return { rows, skipped };
}
