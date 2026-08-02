import { describe, it, expect, beforeAll } from "vitest";
import { createSupplierPart, updateSupplierPartField, upsertSupplierPart } from "@/lib/rfq/sqlite/supplierPartsDb";
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

describe("createSupplierPart", () => {
  it("inserts a row with only the required fields and applies defaults", () => {
    const row = createSupplierPart({ part_number: "NEW-1", supplier_id: "AAG", source: "AAG quote" });
    expect(row.part_number).toBe("NEW-1");
    expect(row.supplier_id).toBe("AAG");
    expect(row.source).toBe("AAG quote");
    expect(row.currency).toBe("USD");
    expect(row.unit_cost).toBeNull();
    expect(row.lead_time).toBeNull();
    expect(row.approval_status).toBeNull();
    expect(row.id).toBeGreaterThan(0);
  });

  it("inserts a row with all optional fields set", () => {
    const row = createSupplierPart({
      part_number: "NEW-2",
      supplier_id: "AAG",
      source: "AAG quote",
      currency: "EUR",
      unit_cost: 2.5,
      lead_time: "4 weeks",
      approval_status: "approved",
    });
    expect(row.currency).toBe("EUR");
    expect(row.unit_cost).toBe(2.5);
    expect(row.lead_time).toBe("4 weeks");
    expect(row.approval_status).toBe("approved");
  });

  it("throws a clear error for a duplicate supplier_id + part_number", () => {
    createSupplierPart({ part_number: "NEW-DUPE", supplier_id: "AAG", source: "AAG quote" });
    expect(() =>
      createSupplierPart({ part_number: "NEW-DUPE", supplier_id: "AAG", source: "AAG quote" }),
    ).toThrow(/already exists/);
  });

  it("does not affect an existing row for a different supplier with the same part_number", () => {
    createSupplierPart({ part_number: "SHARED-1", supplier_id: "AAG", source: "AAG quote" });
    const row = createSupplierPart({ part_number: "SHARED-1", supplier_id: "OTHER", source: "Other quote" });
    expect(row.supplier_id).toBe("OTHER");
  });
});
