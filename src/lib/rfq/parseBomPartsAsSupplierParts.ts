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
 * Every parsed line becomes a row — nothing is dropped for missing pricing/part-number
 * data (`unit_cost` is a nullable column; a missing `mfr_part_number` falls back to
 * `ref_designator` so `part_number`, a NOT NULL column, is never empty; a missing
 * `supplier_id`, also NOT NULL, falls back to "UNKNOWN"). These placeholders are meant
 * to be fixed up afterward via Supplier & Part DB's inline editing rather than silently
 * discarding the line. `skipped` only counts rows the underlying parts parser itself
 * couldn't read at all (no ref_designator and no description) — see
 * parseBomPartsWorkbook.ts.
 */
export function parseBomPartsWorkbookAsSupplierParts(buffer: Buffer): {
  rows: ParsedSupplierPartRow[];
  skipped: number;
} {
  const { rows: bomRows, skipped } = parseBomPartsWorkbook(buffer);

  const rows: ParsedSupplierPartRow[] = bomRows.map((r) => ({
    part_number: r.mfr_part_number || r.ref_designator,
    supplier_id: r.supplier_id || "UNKNOWN",
    source: r.supplier_id || "UNKNOWN",
    currency: r.currency,
    unit_cost: r.unit_cost,
    price_breaks_json: null,
    quote_date: null,
    fetched_at: null,
    lead_time: null,
    approval_status: null,
  }));

  return { rows, skipped };
}
