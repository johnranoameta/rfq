export const EDITABLE_BOM_PART_FIELDS = [
  "ref_designator",
  "description",
  "sub_assembly",
  "customer_program",
  "quantity",
  "unit_cost",
  "mfr_part_number",
] as const;

export type EditableBomPartField = (typeof EDITABLE_BOM_PART_FIELDS)[number];

const NUMERIC_FIELDS: ReadonlySet<EditableBomPartField> = new Set(["quantity", "unit_cost"]);
const REQUIRED_FIELDS: ReadonlySet<EditableBomPartField> = new Set(["ref_designator"]);

export type BomPartFieldValidationResult =
  | { ok: true; value: string | number | null }
  | { ok: false; error: string };

export function isEditableBomPartField(field: string): field is EditableBomPartField {
  return (EDITABLE_BOM_PART_FIELDS as readonly string[]).includes(field);
}

/**
 * Validates a raw edited value for one whitelisted bom_parts field. Numeric fields
 * accept a non-negative number or empty (-> null); everything else is free text,
 * trimmed, empty -> null, except ref_designator which is required non-empty.
 */
export function validateBomPartFieldValue(
  field: EditableBomPartField,
  raw: unknown,
): BomPartFieldValidationResult {
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
