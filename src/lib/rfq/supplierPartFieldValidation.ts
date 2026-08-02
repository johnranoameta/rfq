export const EDITABLE_SUPPLIER_PART_FIELDS = [
  "part_number",
  "supplier_id",
  "source",
  "currency",
  "unit_cost",
  "lead_time",
  "approval_status",
] as const;

export type EditableSupplierPartField = (typeof EDITABLE_SUPPLIER_PART_FIELDS)[number];

const NUMERIC_FIELDS: ReadonlySet<EditableSupplierPartField> = new Set(["unit_cost"]);
const REQUIRED_FIELDS: ReadonlySet<EditableSupplierPartField> = new Set(["part_number", "supplier_id", "source"]);

export type SupplierPartFieldValidationResult =
  | { ok: true; value: string | number | null }
  | { ok: false; error: string };

export function isEditableSupplierPartField(field: string): field is EditableSupplierPartField {
  return (EDITABLE_SUPPLIER_PART_FIELDS as readonly string[]).includes(field);
}

/**
 * Validates a raw edited value for one whitelisted supplier_parts field. `unit_cost`
 * accepts a non-negative number or empty (-> null); everything else is free text,
 * trimmed, empty -> null, except part_number/supplier_id/source (all NOT NULL columns)
 * which are required non-empty.
 */
export function validateSupplierPartFieldValue(
  field: EditableSupplierPartField,
  raw: unknown,
): SupplierPartFieldValidationResult {
  if (NUMERIC_FIELDS.has(field)) {
    if (raw === null || raw === undefined || raw === "") {
      return { ok: true, value: null };
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: `${field} must be a non-negative number` };
    }
    return { ok: true, value: n };
  }

  const text = raw === null || raw === undefined ? "" : String(raw).trim();
  if (REQUIRED_FIELDS.has(field) && !text) {
    return { ok: false, error: `${field} is required` };
  }
  return { ok: true, value: text ? text : null };
}
