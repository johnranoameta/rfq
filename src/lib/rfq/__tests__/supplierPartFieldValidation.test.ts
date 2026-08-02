import { describe, it, expect } from "vitest";
import {
  EDITABLE_SUPPLIER_PART_FIELDS,
  isEditableSupplierPartField,
  validateSupplierPartFieldValue,
} from "@/lib/rfq/supplierPartFieldValidation";

describe("isEditableSupplierPartField", () => {
  it("accepts every field in the whitelist", () => {
    for (const field of EDITABLE_SUPPLIER_PART_FIELDS) {
      expect(isEditableSupplierPartField(field)).toBe(true);
    }
  });

  it("rejects a field outside the whitelist", () => {
    expect(isEditableSupplierPartField("id")).toBe(false);
    expect(isEditableSupplierPartField("price_breaks_json")).toBe(false);
    expect(isEditableSupplierPartField("created_at")).toBe(false);
  });
});

describe("validateSupplierPartFieldValue", () => {
  it("accepts a valid non-negative number for unit_cost", () => {
    expect(validateSupplierPartFieldValue("unit_cost", "1.5")).toEqual({ ok: true, value: 1.5 });
  });

  it("treats an empty unit_cost as null", () => {
    expect(validateSupplierPartFieldValue("unit_cost", "")).toEqual({ ok: true, value: null });
  });

  it("rejects a negative unit_cost", () => {
    expect(validateSupplierPartFieldValue("unit_cost", "-1").ok).toBe(false);
  });

  it("rejects a non-numeric unit_cost", () => {
    expect(validateSupplierPartFieldValue("unit_cost", "not-a-number").ok).toBe(false);
  });

  it("requires part_number, supplier_id, and source to be non-empty", () => {
    expect(validateSupplierPartFieldValue("part_number", "  ").ok).toBe(false);
    expect(validateSupplierPartFieldValue("supplier_id", "").ok).toBe(false);
    expect(validateSupplierPartFieldValue("source", "   ").ok).toBe(false);
  });

  it("trims and keeps required fields", () => {
    expect(validateSupplierPartFieldValue("part_number", "  ABC-123  ")).toEqual({ ok: true, value: "ABC-123" });
  });

  it("treats an empty lead_time or approval_status as null", () => {
    expect(validateSupplierPartFieldValue("lead_time", "")).toEqual({ ok: true, value: null });
    expect(validateSupplierPartFieldValue("approval_status", "   ")).toEqual({ ok: true, value: null });
  });

  it("trims free-text fields", () => {
    expect(validateSupplierPartFieldValue("lead_time", "  4 weeks  ")).toEqual({ ok: true, value: "4 weeks" });
  });
});
