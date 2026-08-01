import * as XLSX from "xlsx";
import type { ParsedRfqWorkbook, WorkbookHeader, WorkbookLineItem } from "@/lib/rfq/parseRfqWorkbook";

export type RfqExtraInfoSheet = {
  sheet: string;
  rows: Record<string, string>[];
};

function normSheet(n: string): string {
  return n.trim().toLowerCase();
}

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

function findSheet(wb: XLSX.WorkBook, name: string): { sheet: XLSX.WorkSheet; originalName: string } | null {
  const hit = wb.SheetNames.find((n) => normSheet(n) === name);
  if (!hit) return null;
  return { sheet: wb.Sheets[hit]!, originalName: hit };
}

/**
 * Reads a sheet's rows with original (non-normalized) column headers, for display
 * purposes (extraInfo) rather than field-mapped parsing.
 */
function readRawRows(sheet: XLSX.WorkSheet): Record<string, string>[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      out[String(k)] = v === null || v === undefined ? "" : String(v).trim();
    }
    return out;
  });
}

/**
 * Detects the BOM Intelligence upload shape (a `parts` sheet, optionally alongside
 * `README`/`suppliers`) as distinct from the strict 4-sheet RFQ workbook shape
 * (Header, Line_Items, Technical_Specs, Supplier_Responses) parseRfqWorkbook.ts expects.
 */
export function looksLikeBomPartsRfqUpload(buffer: Buffer): boolean {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const names = new Set(wb.SheetNames.map(normSheet));
  if (!names.has("parts")) return false;
  if (names.has("header") || names.has("line_items")) return false;
  return true;
}

function partsRecordsToLineItems(records: Record<string, string>[]): WorkbookLineItem[] {
  const out: WorkbookLineItem[] = [];
  for (const r of records) {
    const ref_designator = pick(r, ["ref_designator", "ref designator", "reference_designator"]);
    const description = pick(r, ["description"]);
    if (!ref_designator && !description) continue;
    out.push({
      item: ref_designator || description,
      part_name: description || ref_designator,
      system: "",
      subsystem: "",
      level: "",
      material: "",
      process: "",
      target_price: num(pick(r, ["unit_cost", "unit cost", "cost"])),
      tooling: "",
      thickness_mm: null,
      annual_volume: null,
    });
  }
  return out;
}

function firstNonEmptyCustomerProgram(records: Record<string, string>[]): string {
  for (const r of records) {
    const cp = pick(r, ["customer_program", "customer program", "program"]);
    if (cp) return cp;
  }
  return "";
}

/**
 * Adapts a BOM Intelligence-shaped workbook (README/suppliers/parts) into the same
 * ParsedRfqWorkbook shape parseRfqWorkbook.ts produces, so it can flow through the
 * existing RFQ analysis pipeline unmodified. README/suppliers content has no
 * equivalent in the 4-sheet RFQ shape, so it's returned separately as `extraInfo`
 * for display rather than forced into ill-fitting fields.
 */
export function parseBomPartsAsRfqWorkbook(buffer: Buffer): {
  workbook: ParsedRfqWorkbook;
  extraInfo: RfqExtraInfoSheet[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const partsHit = findSheet(wb, "parts");
  const partsRecords = partsHit
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(partsHit.sheet, { defval: "", raw: false }).map(rowToRecord)
    : [];

  const header: WorkbookHeader = {
    rfq_id: firstNonEmptyCustomerProgram(partsRecords),
    customer: "",
    region: "",
    annual_volume: 0,
    currency: "USD",
    sop: "",
  };

  const workbook: ParsedRfqWorkbook = {
    header,
    line_items: partsRecordsToLineItems(partsRecords),
    technical_specs: [],
    supplier_responses: [],
    suppliers_grouped: [],
  };

  const extraInfo: RfqExtraInfoSheet[] = [];
  for (const name of ["readme", "suppliers"]) {
    const hit = findSheet(wb, name);
    if (!hit) continue;
    const rows = readRawRows(hit.sheet);
    if (rows.length === 0) continue;
    extraInfo.push({ sheet: hit.originalName, rows });
  }

  return { workbook, extraInfo };
}
