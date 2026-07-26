import * as XLSX from "xlsx";

export type ParsedBomPartRow = {
  supplier_id: string | null;
  customer_program: string | null;
  sub_assembly: string | null;
  ref_designator: string;
  description: string | null;
  quantity: number | null;
  unit_cost: number | null;
  currency: string;
  mfr_part_number: string | null;
  extended_attributes_json: string | null;
  raw_source_ref: string | null;
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

function extractMfrPartNumber(extendedAttributesJson: string): string | null {
  try {
    const parsed = JSON.parse(extendedAttributesJson) as Record<string, unknown>;
    const raw = parsed["mfr_part_number"];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    return null;
  } catch {
    return null;
  }
}

/**
 * Parses an uploaded BOM/parts workbook — the format produced by
 * docs/sample_supplier_and_part_data.xlsx (a `parts` sheet, one row per BOM line
 * within a specific customer program/quote; optional `suppliers` sheet, not read
 * here). This is a distinct upload from the RFQ package itself — the Costing agent
 * uses it to know which BOM lines exist and their manufacturer part numbers, then
 * looks up cost via the dual-source (internal/external) engine keyed on
 * mfr_part_number.
 *
 * Expected `parts` sheet columns (case/spacing-insensitive): supplier_id,
 * customer_program, sub_assembly, ref_designator, description, quantity, unit_cost,
 * currency, extended_attributes_json, raw_source_ref. ref_designator is required;
 * malformed rows are skipped rather than failing the whole upload.
 */
export function parseBomPartsWorkbook(buffer: Buffer): {
  rows: ParsedBomPartRow[];
  skipped: number;
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames.find((n) => normCellKey(n) === "parts") ?? wb.SheetNames[0] ?? "";
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { rows: [], skipped: 0 };

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const records = raw.map(rowToRecord);

  const rows: ParsedBomPartRow[] = [];
  let skipped = 0;
  for (const r of records) {
    const ref_designator = pick(r, ["ref_designator", "ref designator", "reference_designator"]);
    if (!ref_designator) {
      skipped++;
      continue;
    }
    const extendedAttributesRaw = pick(r, ["extended_attributes_json", "extended attributes"]);
    let extended_attributes_json: string | null = null;
    let mfr_part_number: string | null = null;
    if (extendedAttributesRaw) {
      try {
        const parsed = JSON.parse(extendedAttributesRaw);
        if (parsed && typeof parsed === "object") {
          extended_attributes_json = JSON.stringify(parsed);
          mfr_part_number = extractMfrPartNumber(extended_attributes_json);
        }
      } catch {
        // Malformed extension JSON is dropped; row still imports without it.
      }
    }
    rows.push({
      supplier_id: pick(r, ["supplier_id", "supplier id", "supplier"]).toUpperCase() || null,
      customer_program: pick(r, ["customer_program", "customer program", "program"]) || null,
      sub_assembly: pick(r, ["sub_assembly", "sub assembly", "assembly"]) || null,
      ref_designator,
      description: pick(r, ["description"]) || null,
      quantity: num(pick(r, ["quantity", "qty"])),
      unit_cost: num(pick(r, ["unit_cost", "unit cost", "cost"])),
      currency: pick(r, ["currency"]) || "USD",
      mfr_part_number: mfr_part_number ?? (pick(r, ["mfr_part_number", "manufacturer_part_number", "mpn"]) || null),
      extended_attributes_json,
      raw_source_ref: pick(r, ["raw_source_ref", "raw source ref", "source_ref"]) || null,
    });
  }

  return { rows, skipped };
}
