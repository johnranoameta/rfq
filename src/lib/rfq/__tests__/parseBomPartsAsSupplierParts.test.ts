import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseBomPartsWorkbookAsSupplierParts } from "@/lib/rfq/parseBomPartsAsSupplierParts";

function workbookBuffer(rows: Record<string, unknown>[], sheetName = "parts"): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseBomPartsWorkbookAsSupplierParts", () => {
  it("maps a parts row with mfr_part_number, supplier_id, and unit_cost into a supplier_parts row", () => {
    const buf = workbookBuffer([
      {
        supplier_id: "aag",
        ref_designator: "PCB",
        unit_cost: 1.026,
        currency: "USD",
        extended_attributes_json: JSON.stringify({ mfr_part_number: "DRW S05137-38" }),
      },
    ]);
    const { rows, skipped } = parseBomPartsWorkbookAsSupplierParts(buf);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      part_number: "DRW S05137-38",
      supplier_id: "AAG",
      source: "AAG",
      currency: "USD",
      unit_cost: 1.026,
    });
  });

  it("skips a row with no manufacturer part number", () => {
    const buf = workbookBuffer([
      { supplier_id: "AAG", ref_designator: "Label", unit_cost: 0.005, currency: "USD" },
    ]);
    const { rows, skipped } = parseBomPartsWorkbookAsSupplierParts(buf);
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("skips a row with no supplier_id", () => {
    const buf = workbookBuffer([
      {
        ref_designator: "R1",
        unit_cost: 0.05,
        currency: "USD",
        extended_attributes_json: JSON.stringify({ mfr_part_number: "CRCW06032K20JNEA" }),
      },
    ]);
    const { rows, skipped } = parseBomPartsWorkbookAsSupplierParts(buf);
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("skips a row with no unit_cost", () => {
    const buf = workbookBuffer([
      {
        supplier_id: "AAG",
        ref_designator: "R1",
        currency: "USD",
        extended_attributes_json: JSON.stringify({ mfr_part_number: "CRCW06032K20JNEA" }),
      },
    ]);
    const { rows, skipped } = parseBomPartsWorkbookAsSupplierParts(buf);
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("counts rows dropped by the underlying parts parser (e.g. missing ref_designator) as skipped too", () => {
    const buf = workbookBuffer([
      { supplier_id: "AAG", ref_designator: "", unit_cost: 1, currency: "USD" },
      {
        supplier_id: "AAG",
        ref_designator: "R1",
        unit_cost: 0.05,
        currency: "USD",
        extended_attributes_json: JSON.stringify({ mfr_part_number: "CRCW06032K20JNEA" }),
      },
    ]);
    const { rows, skipped } = parseBomPartsWorkbookAsSupplierParts(buf);
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("imports multiple valid rows from a realistic multi-row parts sheet", () => {
    const buf = workbookBuffer([
      {
        supplier_id: "AAG",
        ref_designator: "PCB",
        unit_cost: 1.026,
        currency: "USD",
        extended_attributes_json: JSON.stringify({ mfr_part_number: "DRW S05137-38" }),
      },
      {
        supplier_id: "AAG",
        ref_designator: "Male Connector PIN - J1",
        unit_cost: 0,
        currency: "USD",
        extended_attributes_json: JSON.stringify({ mfr_part_number: "DRW S05267 EFS 08-0077-P" }),
      },
      { supplier_id: "AAG", ref_designator: "Label", unit_cost: 0.005, currency: "USD" },
    ]);
    const { rows, skipped } = parseBomPartsWorkbookAsSupplierParts(buf);
    expect(rows).toHaveLength(2);
    expect(skipped).toBe(1);
  });
});
