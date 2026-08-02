import { describe, it, expect, beforeAll } from "vitest";
import { updateSupplierPartField, upsertSupplierPart } from "@/lib/rfq/sqlite/supplierPartsDb";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";
import type { EditableSupplierPartField } from "@/lib/rfq/supplierPartFieldValidation";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function insertRow(partNumber: string, supplierId: string): number {
  upsertSupplierPart({ part_number: partNumber, supplier_id: supplierId, source: supplierId, unit_cost: 1.5 });
  const db = getRfqDb();
  const row = db
    .prepare(`SELECT id FROM supplier_parts WHERE part_number = ? AND supplier_id = ?`)
    .get(partNumber, supplierId) as { id: number };
  return row.id;
}

describe("updateSupplierPartField", () => {
  it("updates a text field", () => {
    const id = insertRow("ABC-1", "AAG");
    const row = updateSupplierPartField(id, "lead_time", "4 weeks");
    expect(row?.lead_time).toBe("4 weeks");
  });

  it("updates a numeric field", () => {
    const id = insertRow("ABC-2", "AAG");
    const row = updateSupplierPartField(id, "unit_cost", 3.25);
    expect(row?.unit_cost).toBe(3.25);
  });

  it("sets unit_cost to null", () => {
    const id = insertRow("ABC-3", "AAG");
    const row = updateSupplierPartField(id, "unit_cost", null);
    expect(row?.unit_cost).toBeNull();
  });

  it("updates part_number", () => {
    const id = insertRow("ABC-4", "AAG");
    const row = updateSupplierPartField(id, "part_number", "REAL-PART-NUMBER");
    expect(row?.part_number).toBe("REAL-PART-NUMBER");
  });

  it("returns null when the row does not exist", () => {
    const row = updateSupplierPartField(999999, "lead_time", "x");
    expect(row).toBeNull();
  });

  it("rejects a field outside the editable whitelist", () => {
    const id = insertRow("ABC-5", "AAG");
    expect(() => updateSupplierPartField(id, "id" as EditableSupplierPartField, 999)).toThrow();
  });

  it("throws a clear error when editing into a duplicate supplier_id + part_number", () => {
    insertRow("DUPE-1", "AAG");
    const id2 = insertRow("DUPE-2", "AAG");
    expect(() => updateSupplierPartField(id2, "part_number", "DUPE-1")).toThrow(/already has this/);
  });
});
