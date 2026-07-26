import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";
import { EXTERNAL_SUPPLIER_ID } from "@/lib/rfq/externalPriceFetcher";
import type { SupplierPartRow } from "@/lib/rfq/costLookupTypes";

const SELECT_COLUMNS = `id, part_number, supplier_id, source, currency, unit_cost, price_breaks_json,
  quote_date, fetched_at, lead_time, approval_status, created_at, updated_at`;

export function listSupplierParts(): SupplierPartRow[] {
  const db = getRfqDb();
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM supplier_parts ORDER BY part_number ASC, supplier_id ASC`)
    .all() as SupplierPartRow[];
}

export function getInternalCostRows(partNumber: string): SupplierPartRow[] {
  const db = getRfqDb();
  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM supplier_parts WHERE part_number = ? AND supplier_id != ? ORDER BY id ASC`,
    )
    .all(partNumber, EXTERNAL_SUPPLIER_ID) as SupplierPartRow[];
}

export function getExternalCostRow(partNumber: string): SupplierPartRow | undefined {
  const db = getRfqDb();
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM supplier_parts WHERE part_number = ? AND supplier_id = ?`)
    .get(partNumber, EXTERNAL_SUPPLIER_ID) as SupplierPartRow | undefined;
}

export function upsertSupplierPart(record: {
  part_number: string;
  supplier_id: string;
  source: string;
  currency?: string;
  unit_cost?: number | null;
  price_breaks_json?: string | null;
  quote_date?: string | null;
  fetched_at?: string | null;
  lead_time?: string | null;
  approval_status?: string | null;
}): void {
  const db = getRfqDb();
  db.prepare(
    `INSERT INTO supplier_parts (
       part_number, supplier_id, source, currency, unit_cost, price_breaks_json,
       quote_date, fetched_at, lead_time, approval_status, updated_at
     ) VALUES (@part_number, @supplier_id, @source, @currency, @unit_cost, @price_breaks_json,
       @quote_date, @fetched_at, @lead_time, @approval_status, datetime('now'))
     ON CONFLICT(supplier_id, part_number) DO UPDATE SET
       source = excluded.source,
       currency = excluded.currency,
       unit_cost = excluded.unit_cost,
       price_breaks_json = excluded.price_breaks_json,
       quote_date = excluded.quote_date,
       fetched_at = excluded.fetched_at,
       lead_time = excluded.lead_time,
       approval_status = excluded.approval_status,
       updated_at = datetime('now')`,
  ).run({
    currency: "USD",
    unit_cost: null,
    price_breaks_json: null,
    quote_date: null,
    fetched_at: null,
    lead_time: null,
    approval_status: null,
    ...record,
  });
}
