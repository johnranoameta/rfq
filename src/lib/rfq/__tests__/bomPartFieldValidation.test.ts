import { describe, it, expect } from "vitest";
import {
  EDITABLE_BOM_PART_FIELDS,
  isEditableBomPartField,
  validateBomPartFieldValue,
} from "@/lib/rfq/bomPartFieldValidation";

describe("isEditableBomPartField", () => {
  it("accepts every field in the whitelist", () => {
    for (const field of EDITABLE_BOM_PART_FIELDS) {
      expect(isEditableBomPartField(field)).toBe(true);
    }
  });

  it("rejects a field outside the whitelist", () => {
    expect(isEditableBomPartField("rfq_file_id")).toBe(false);
    expect(isEditableBomPartField("id")).toBe(false);
    expect(isEditableBomPartField("extended_attributes_json")).toBe(false);
  });
});

describe("validateBomPartFieldValue", () => {
  it("accepts a valid non-negative number for quantity", () => {
    expect(validateBomPartFieldValue("quantity", "12")).toEqual({ ok: true, value: 12 });
  });

  it("accepts a valid non-negative number for unit_cost", () => {
    expect(validateBomPartFieldValue("unit_cost", "1.5")).toEqual({ ok: true, value: 1.5 });
  });

  it("treats an empty numeric value as null", () => {
    expect(validateBomPartFieldValue("quantity", "")).toEqual({ ok: true, value: null });
    expect(validateBomPartFieldValue("unit_cost", "")).toEqual({ ok: true, value: null });
  });

  it("rejects a negative number", () => {
    const result = validateBomPartFieldValue("quantity", "-1");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric value", () => {
    const result = validateBomPartFieldValue("unit_cost", "not-a-number");
    expect(result.ok).toBe(false);
  });

  it("requires ref_designator to be non-empty", () => {
    const result = validateBomPartFieldValue("ref_designator", "  ");
    expect(result.ok).toBe(false);
  });

  it("trims and keeps a non-empty ref_designator", () => {
    expect(validateBomPartFieldValue("ref_designator", "  R1  ")).toEqual({ ok: true, value: "R1" });
  });

  it("treats an empty free-text field as null", () => {
    expect(validateBomPartFieldValue("description", "")).toEqual({ ok: true, value: null });
    expect(validateBomPartFieldValue("mfr_part_number", "   ")).toEqual({ ok: true, value: null });
  });

  it("trims free-text fields", () => {
    expect(validateBomPartFieldValue("sub_assembly", "  LATCH ECU  ")).toEqual({
      ok: true,
      value: "LATCH ECU",
    });
  });
});
