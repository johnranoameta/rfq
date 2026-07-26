import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSupplierPartsWorkbook } from "@/lib/rfq/parseSupplierPartsWorkbook";

function workbookBuffer(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "supplier_parts");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseSupplierPartsWorkbook", () => {
  it("parses rows with the expected columns", () => {
    const buf = workbookBuffer([
      {
        part_number: "ABC-123",
        supplier_id: "acme",
        source: "Internal",
        currency: "USD",
        unit_cost: 0.072,
        quote_date: "2025-03-10",
      },
    ]);
    const { rows, skipped } = parseSupplierPartsWorkbook(buf);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      part_number: "ABC-123",
      supplier_id: "ACME",
      source: "Internal",
      currency: "USD",
      unit_cost: 0.072,
      quote_date: "2025-03-10",
    });
  });

  it("uppercases supplier_id and defaults source to supplier_id when blank", () => {
    const buf = workbookBuffer([{ part_number: "X-1", supplier_id: "trustedparts" }]);
    const { rows } = parseSupplierPartsWorkbook(buf);
    expect(rows[0].supplier_id).toBe("TRUSTEDPARTS");
    expect(rows[0].source).toBe("trustedparts");
  });

  it("parses a valid price_breaks_json array", () => {
    const buf = workbookBuffer([
      {
        part_number: "ABC-123",
        supplier_id: "TRUSTEDPARTS",
        price_breaks_json: JSON.stringify([{ min_qty: 1000, unit_cost: 0.0685 }]),
      },
    ]);
    const { rows } = parseSupplierPartsWorkbook(buf);
    expect(JSON.parse(rows[0].price_breaks_json!)).toEqual([{ min_qty: 1000, unit_cost: 0.0685 }]);
  });

  it("drops malformed price_breaks_json without failing the row", () => {
    const buf = workbookBuffer([
      { part_number: "ABC-123", supplier_id: "ACME", unit_cost: 1, price_breaks_json: "not json" },
    ]);
    const { rows, skipped } = parseSupplierPartsWorkbook(buf);
    expect(skipped).toBe(0);
    expect(rows[0].price_breaks_json).toBeNull();
    expect(rows[0].unit_cost).toBe(1);
  });

  it("skips rows missing part_number or supplier_id", () => {
    const buf = workbookBuffer([
      { part_number: "", supplier_id: "ACME", unit_cost: 1 },
      { part_number: "X-1", supplier_id: "", unit_cost: 1 },
      { part_number: "X-2", supplier_id: "ACME", unit_cost: 1 },
    ]);
    const { rows, skipped } = parseSupplierPartsWorkbook(buf);
    expect(skipped).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0].part_number).toBe("X-2");
  });
});
