import * as XLSX from "xlsx";

export type WorkbookHeader = {
  rfq_id: string;
  customer: string;
  region: string;
  annual_volume: number;
  currency: string;
  sop: string;
};

export type WorkbookLineItem = {
  item: string;
  part_name: string;
  system: string;
  subsystem: string;
  level: string;
  material: string;
  process: string;
  target_price: number | null;
  tooling: string;
};

export type WorkbookTechSpec = {
  part_name: string;
  spec_text: string;
};

export type WorkbookSupplierRow = {
  supplier: string;
  item: string;
  quoted_price: number | null;
  lead_time_weeks: number | null;
  assumptions: string;
  deviations: string;
};

export type ParsedRfqWorkbook = {
  header: WorkbookHeader;
  line_items: WorkbookLineItem[];
  technical_specs: WorkbookTechSpec[];
  supplier_responses: WorkbookSupplierRow[];
  /** Same rows grouped: one supplier may quote multiple line items. */
  suppliers_grouped: { supplier: string; quotes: WorkbookSupplierRow[] }[];
};

function normSheet(n: string): string {
  return n.trim().replace(/\s+/g, "_").toLowerCase();
}

function findSheetName(wb: XLSX.WorkBook, candidates: string[]): string | null {
  const names = new Map(wb.SheetNames.map((s) => [normSheet(s), s] as const));
  for (const c of candidates) {
    const hit = names.get(normSheet(c));
    if (hit) return hit;
  }
  return null;
}

function normCellKey(k: string): string {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** Normalize messy part labels for matching specs ↔ lines. */
export function normPartKey(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rowToRecord(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normCellKey(k)] = v === null || v === undefined ? "" : String(v).trim();
  }
  return out;
}

function num(v: string): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function readObjects(sheet: XLSX.WorkSheet | undefined): Record<string, string>[] {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rows.map(rowToRecord);
}

function pick(r: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const nk = normCellKey(k);
    if (r[nk] !== undefined && r[nk] !== "") return r[nk];
  }
  for (const [k, v] of Object.entries(r)) {
    for (const want of keys) {
      if (normCellKey(want) === k && v) return v;
    }
  }
  return "";
}

function parseHeaderSheet(sheet: XLSX.WorkSheet | undefined): WorkbookHeader {
  const rows = readObjects(sheet);
  const r = rows[0] ?? {};
  return {
    rfq_id: pick(r, ["rfq_id", "rfq id", "id"]),
    customer: pick(r, ["customer", "oem", "client"]),
    region: pick(r, ["region", "geo"]),
    annual_volume: num(pick(r, ["annual_volume", "annual volume", "volume", "annual_vol"])) ?? 0,
    currency: pick(r, ["currency", "curr"]) || "USD",
    sop: pick(r, ["sop", "sop_date", "sop date", "start_of_production"]),
  };
}

function parseLineItems(sheet: XLSX.WorkSheet | undefined): WorkbookLineItem[] {
  const rows = readObjects(sheet);
  const out: WorkbookLineItem[] = [];
  for (const r of rows) {
    const item = pick(r, ["item", "line", "no", "ln"]);
    const part_name = pick(r, ["part_name", "part name", "description", "part"]);
    if (!item && !part_name) continue;
    out.push({
      item: item || part_name.slice(0, 8),
      part_name: part_name || item,
      system: pick(r, ["system", "sys"]),
      subsystem: pick(r, ["subsystem", "sub_system", "sub system"]),
      level: pick(r, ["level", "critically", "criticality"]),
      material: pick(r, ["material", "mat"]),
      process: pick(r, ["process", "proc", "manufacturing_process"]),
      target_price: num(pick(r, ["target_price", "target price", "target", "tgt_price"])),
      tooling: pick(r, ["tooling", "tooling_flag", "tooling flag", "nre"]),
    });
  }
  return out;
}

function parseTechSpecs(sheet: XLSX.WorkSheet | undefined): WorkbookTechSpec[] {
  const rows = readObjects(sheet);
  return rows
    .map((r) => ({
      part_name: pick(r, ["part_name", "part name", "part", "item"]),
      spec_text: pick(r, ["spec_text", "spec", "requirements", "text", "notes"]),
    }))
    .filter((x) => x.part_name || x.spec_text);
}

function parseSupplierResponses(sheet: XLSX.WorkSheet | undefined): WorkbookSupplierRow[] {
  const rows = readObjects(sheet);
  const out: WorkbookSupplierRow[] = [];
  for (const r of rows) {
    const supplier = pick(r, ["supplier", "vendor", "bidder"]);
    const item = pick(r, ["item", "line", "line_item", "line item"]);
    if (!supplier && !item) continue;
    out.push({
      supplier: supplier || "—",
      item: item || "—",
      quoted_price: num(pick(r, ["quoted_price", "quoted price", "price", "quote"])),
      lead_time_weeks: num(pick(r, ["lead_time_weeks", "lead time weeks", "lead_time", "lead weeks", "lt"])),
      assumptions: pick(r, ["assumptions", "assumption", "notes_assumption"]),
      deviations: pick(r, ["deviations", "deviation", "exceptions"]),
    });
  }
  return out;
}

function groupBySupplier(rows: WorkbookSupplierRow[]): { supplier: string; quotes: WorkbookSupplierRow[] }[] {
  const m = new Map<string, WorkbookSupplierRow[]>();
  for (const row of rows) {
    const s = row.supplier.trim() || "—";
    if (!m.has(s)) m.set(s, []);
    m.get(s)!.push(row);
  }
  return [...m.entries()].map(([supplier, quotes]) => ({ supplier, quotes }));
}

export function techSpecForPart(
  partName: string,
  specs: WorkbookTechSpec[],
): WorkbookTechSpec | null {
  const key = normPartKey(partName);
  if (!key) return null;
  let best: WorkbookTechSpec | null = null;
  let bestScore = 0;
  for (const s of specs) {
    const sk = normPartKey(s.part_name);
    if (!sk) continue;
    if (key === sk) return s;
    if (key.includes(sk) || sk.includes(key)) {
      const score = Math.min(key.length, sk.length);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
  }
  return best;
}

/**
 * Reads a 4-sheet RFQ workbook (Header, Line_Items, Technical_Specs, Supplier_Responses).
 * Sheet names are matched case-insensitively with common aliases.
 */
export function parseRfqWorkbook(buffer: Buffer): ParsedRfqWorkbook {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const shHeader = findSheetName(wb, ["header", "rfq_header", "context"]);
  const shLines = findSheetName(wb, ["line_items", "lineitems", "items", "parts", "bom"]);
  const shTech = findSheetName(wb, ["technical_specs", "technicalspecs", "specs", "tech_specs"]);
  const shSupp = findSheetName(wb, ["supplier_responses", "supplierresponses", "quotes", "responses"]);

  if (!shHeader || !shLines || !shTech || !shSupp) {
    const have = wb.SheetNames.join(", ");
    throw new Error(
      `Workbook must include sheets: Header, Line_Items, Technical_Specs, Supplier_Responses (found: ${have})`,
    );
  }

  const header = parseHeaderSheet(wb.Sheets[shHeader]);
  const line_items = parseLineItems(wb.Sheets[shLines]);
  const technical_specs = parseTechSpecs(wb.Sheets[shTech]);
  const supplier_responses = parseSupplierResponses(wb.Sheets[shSupp]);
  const suppliers_grouped = groupBySupplier(supplier_responses);

  return {
    header,
    line_items,
    technical_specs,
    supplier_responses,
    suppliers_grouped,
  };
}
