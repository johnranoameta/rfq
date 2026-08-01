import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";
import type { BomPartRow } from "@/lib/rfq/costLookupTypes";
import type { ParsedBomPartRow } from "@/lib/rfq/parseBomPartsWorkbook";
import { isEditableBomPartField, type EditableBomPartField } from "@/lib/rfq/bomPartFieldValidation";

const SELECT_COLUMNS = `id, rfq_file_id, supplier_id, customer_program, sub_assembly, ref_designator,
  description, quantity, unit_cost, currency, mfr_part_number, extended_attributes_json, raw_source_ref, created_at`;

export function listBomParts(rfqFileId: string): BomPartRow[] {
  const db = getRfqDb();
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM bom_parts WHERE rfq_file_id = ? ORDER BY id ASC`)
    .all(rfqFileId) as BomPartRow[];
}

/** Replaces every bom_parts row for this RFQ with the newly uploaded set (whole-file re-import). */
export function replaceBomParts(rfqFileId: string, rows: ParsedBomPartRow[]): void {
  const db = getRfqDb();
  const del = db.prepare(`DELETE FROM bom_parts WHERE rfq_file_id = ?`);
  const ins = db.prepare(
    `INSERT INTO bom_parts (
       rfq_file_id, supplier_id, customer_program, sub_assembly, ref_designator,
       description, quantity, unit_cost, currency, mfr_part_number, extended_attributes_json, raw_source_ref
     ) VALUES (@rfq_file_id, @supplier_id, @customer_program, @sub_assembly, @ref_designator,
       @description, @quantity, @unit_cost, @currency, @mfr_part_number, @extended_attributes_json, @raw_source_ref)`,
  );
  const tx = db.transaction((rowsToInsert: ParsedBomPartRow[]) => {
    del.run(rfqFileId);
    for (const r of rowsToInsert) {
      ins.run({ rfq_file_id: rfqFileId, ...r });
    }
  });
  tx(rows);
}

/**
 * Updates a single whitelisted field on one bom_parts row (BOM Intelligence inline
 * editing, issue #17). No original-value tracking or audit log in v1 — a straight
 * overwrite. Re-checks the whitelist at this boundary (not just at the API layer)
 * since `field` is interpolated directly into the UPDATE statement.
 */
export function updateBomPartField(
  id: number,
  field: EditableBomPartField,
  value: string | number | null,
): BomPartRow | null {
  if (!isEditableBomPartField(field)) {
    throw new Error(`Field "${field}" is not editable`);
  }
  const db = getRfqDb();
  db.prepare(`UPDATE bom_parts SET ${field} = ? WHERE id = ?`).run(value, id);
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM bom_parts WHERE id = ?`).get(id) as BomPartRow | undefined;
  return row ?? null;
}
