import { describe, it, expect, beforeAll } from "vitest";
import { updateBomPartField } from "@/lib/rfq/sqlite/bomPartsDb";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";
import type { EditableBomPartField } from "@/lib/rfq/bomPartFieldValidation";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function insertRow(): number {
  const db = getRfqDb();
  const info = db
    .prepare(
      `INSERT INTO bom_parts (rfq_file_id, ref_designator, description, quantity, unit_cost, currency)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run("file-1", "R1", "resistor", 2, 1.5, "USD");
  return Number(info.lastInsertRowid);
}

describe("updateBomPartField", () => {
  it("updates a text field", () => {
    const id = insertRow();
    const row = updateBomPartField(id, "description", "updated resistor");
    expect(row?.description).toBe("updated resistor");
  });

  it("updates a numeric field", () => {
    const id = insertRow();
    const row = updateBomPartField(id, "unit_cost", 3.25);
    expect(row?.unit_cost).toBe(3.25);
  });

  it("sets a numeric field to null", () => {
    const id = insertRow();
    const row = updateBomPartField(id, "quantity", null);
    expect(row?.quantity).toBeNull();
  });

  it("returns null when the row does not exist", () => {
    const row = updateBomPartField(999999, "description", "x");
    expect(row).toBeNull();
  });

  it("rejects a field outside the editable whitelist", () => {
    const id = insertRow();
    expect(() => updateBomPartField(id, "rfq_file_id" as EditableBomPartField, "hacked")).toThrow();
  });
});
