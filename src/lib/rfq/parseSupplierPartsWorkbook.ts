import * as XLSX from "xlsx";

export type ParsedSupplierPartRow = {
  part_number: string;
  supplier_id: string;
  source: string;
  currency: string;
  unit_cost: number | null;
  price_breaks_json: string | null;
  quote_date: string | null;
  fetched_at: string | null;
  lead_time: string | null;
  approval_status: string | null;
};

function normCellKey(k: string): string {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function rowToRecord(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normCellKey(k)] = v === null || v === undefined ? "" : String(v).trim();
  }
  return out;
}

function pick(r: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const nk = normCellKey(k);
    if (r[nk] !== undefined && r[nk] !== "") return r[nk];
  }
  return "";
}

function num(v: string): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses an uploaded "Supplier & Part DB" workbook — one row per supplier_parts
 * record. First sheet is used. Expected columns (case/spacing-insensitive):
 * part_number, supplier_id, source, currency, unit_cost, price_breaks_json,
 * quote_date, fetched_at, lead_time, approval_status. part_number and supplier_id
 * are required; malformed rows are skipped rather than failing the whole upload.
 */
export function parseSupplierPartsWorkbook(buffer: Buffer): {
  rows: ParsedSupplierPartRow[];
  skipped: number;
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet) return { rows: [], skipped: 0 };

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const records = raw.map(rowToRecord);

  const rows: ParsedSupplierPartRow[] = [];
  let skipped = 0;
  for (const r of records) {
    const part_number = pick(r, ["part_number", "part number", "mfr_part_number", "mpn"]);
    const supplier_id = pick(r, ["supplier_id", "supplier id", "supplier"]);
    if (!part_number || !supplier_id) {
      skipped++;
      continue;
    }
    const priceBreaksRaw = pick(r, ["price_breaks_json", "price breaks", "price_breaks"]);
    let price_breaks_json: string | null = null;
    if (priceBreaksRaw) {
      try {
        const parsed = JSON.parse(priceBreaksRaw);
        if (Array.isArray(parsed)) price_breaks_json = JSON.stringify(parsed);
      } catch {
        // Malformed price-break JSON is dropped; row still imports with flat unit_cost.
      }
    }
    rows.push({
      part_number,
      supplier_id: supplier_id.toUpperCase(),
      source: pick(r, ["source"]) || supplier_id,
      currency: pick(r, ["currency"]) || "USD",
      unit_cost: num(pick(r, ["unit_cost", "unit cost", "cost"])),
      price_breaks_json,
      quote_date: pick(r, ["quote_date", "quote date"]) || null,
      fetched_at: pick(r, ["fetched_at", "fetched date", "fetch_date"]) || null,
      lead_time: pick(r, ["lead_time", "lead time"]) || null,
      approval_status: pick(r, ["approval_status", "approval status", "status"]) || null,
    });
  }

  return { rows, skipped };
}
