import * as XLSX from "xlsx";
import type { ParsedRfqWorkbook, WorkbookHeader, WorkbookLineItem } from "@/lib/rfq/parseRfqWorkbook";
import type { ParsedBomPartRow } from "@/lib/rfq/parseBomPartsWorkbook";

export type AagToolingItem = {
  description: string;
  sub_total: number | null;
};

export type AagCostElements = {
  bom_cost: number | null;
  loss_rate: number | null;
  labor: number | null;
  overhead_burden: number | null;
  sga: number | null;
  profit: number | null;
  packaging_cost: number | null;
  fob_shanghai: number | null;
  fob_huntsville: number | null;
  tooling_items: AagToolingItem[];
  tooling_total: number | null;
};

type Grid = unknown[][];

function cellText(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function cellTextLower(v: unknown): string {
  return cellText(v).toLowerCase();
}

function cellNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cellText(v);
  if (!s) return null;
  const n = Number(s.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function readGrid(wb: XLSX.WorkBook, sheetName: string): Grid {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
}

/**
 * Detects the AAG "single-sheet quote" shape: one sheet containing a BOM line-item
 * table (header row with "Item #" + "Ref Designation") and, elsewhere in the same
 * sheet, a cost-breakdown block (a "BOM cost" label cell) — as opposed to the strict
 * 4-sheet RFQ shape or the README/suppliers/parts BOM Intelligence shape, both of
 * which use separate sheets rather than one sheet mixing header + BOM + cost data.
 */
export function looksLikeAagSingleSheetQuote(buffer: Buffer): boolean {
  const wb = XLSX.read(buffer, { type: "buffer" });
  for (const sheetName of wb.SheetNames) {
    const grid = readGrid(wb, sheetName);
    let hasBomTableHeader = false;
    let hasCostBreakdown = false;
    for (const row of grid) {
      const cells = row.map(cellTextLower);
      if (cells.includes("item #") && cells.some((c) => c.startsWith("ref designation"))) {
        hasBomTableHeader = true;
      }
      if (cells.includes("bom cost")) {
        hasCostBreakdown = true;
      }
    }
    if (hasBomTableHeader && hasCostBreakdown) return true;
  }
  return false;
}

/** Finds a header cell (exact match to header text) and returns { row, col } or null. */
function findHeaderRow(
  grid: Grid,
  requiredHeaders: string[],
): { rowIndex: number; columns: Map<string, number> } | null {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const columns = new Map<string, number>();
    for (let c = 0; c < row.length; c++) {
      columns.set(cellTextLower(row[c]), c);
    }
    if (requiredHeaders.every((h) => columns.has(h))) {
      return { rowIndex: r, columns };
    }
  }
  return null;
}

type BomTableRow = {
  itemNo: string;
  qty: number | null;
  refDesignation: string;
  manufacturer: string;
  partNumber: string;
  description: string;
  targetPrice: number | null;
  unitPrice: number | null;
  subTotal: number | null;
  comments: string;
  rowIndex: number;
};

function extractBomTableRows(grid: Grid): BomTableRow[] {
  const header = findHeaderRow(grid, ["item #", "ref designation"]);
  if (!header) return [];
  const { rowIndex: headerRow, columns } = header;
  const colItem = columns.get("item #")!;
  const colQty = columns.get("qty per assy");
  const colRefDes = columns.get("ref designation")!;
  const colMfr = [...columns.entries()].find(([k]) => k.startsWith("manufacturer"))?.[1];
  const colPartNo = columns.get("part number");
  const colDesc = columns.get("description");
  const colTarget = columns.get("target price");
  const colUnit = columns.get("unit price");
  const colSubTotal = [...columns.entries()].find(([k]) => k.replace(/\s+/g, "") === "sub-total")?.[1];
  const colComments = columns.get("comments");

  const out: BomTableRow[] = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const description = cellText(row[colDesc ?? -1]);
    const partNumber = cellText(row[colPartNo ?? -1]);
    const manufacturer = cellText(row[colMfr ?? -1]);
    if (!description && !partNumber && !manufacturer) break;
    out.push({
      itemNo: cellText(row[colItem]),
      qty: cellNumber(row[colQty ?? -1]),
      refDesignation: cellText(row[colRefDes]),
      manufacturer,
      partNumber,
      description,
      targetPrice: cellNumber(row[colTarget ?? -1]),
      unitPrice: cellNumber(row[colUnit ?? -1]),
      subTotal: cellNumber(row[colSubTotal ?? -1]),
      comments: cellText(row[colComments ?? -1]),
      rowIndex: r,
    });
  }
  return out;
}

const COST_LABELS: Record<keyof Omit<AagCostElements, "tooling_items" | "tooling_total">, string> = {
  bom_cost: "bom cost",
  loss_rate: "loss rate",
  labor: "labor",
  overhead_burden: "overhead & burden",
  sga: "sg&a",
  profit: "profit",
  packaging_cost: "packaging cost",
  fob_shanghai: "fob shanghai",
  fob_huntsville: "fob huntsville",
};

function extractCostBreakdown(grid: Grid): Omit<AagCostElements, "tooling_items" | "tooling_total"> {
  const result: Record<string, number | null> = {};
  for (const key of Object.keys(COST_LABELS)) result[key] = null;

  for (const row of grid) {
    for (let c = 0; c < row.length; c++) {
      const label = cellTextLower(row[c]);
      for (const [key, target] of Object.entries(COST_LABELS)) {
        if (label === target && result[key] === null) {
          result[key] = cellNumber(row[c + 1]);
        }
      }
    }
  }
  return result as Omit<AagCostElements, "tooling_items" | "tooling_total">;
}

function extractToolingSection(grid: Grid): { tooling_items: AagToolingItem[]; tooling_total: number | null } {
  let markerRow = -1;
  for (let r = 0; r < grid.length; r++) {
    if ((grid[r] ?? []).some((cell) => cellTextLower(cell) === "tooling cost")) {
      markerRow = r;
      break;
    }
  }
  if (markerRow === -1) return { tooling_items: [], tooling_total: null };

  const header = findHeaderRow(grid.slice(markerRow), ["description", "sub-total"]);
  if (!header) return { tooling_items: [], tooling_total: null };
  const headerRow = markerRow + header.rowIndex;
  const colDesc = header.columns.get("description")!;
  const colSubTotal = header.columns.get("sub-total")!;

  const tooling_items: AagToolingItem[] = [];
  let tooling_total: number | null = null;
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const description = cellText(row[colDesc]);
    const subTotal = cellNumber(row[colSubTotal]);
    if (description) {
      tooling_items.push({ description, sub_total: subTotal });
    } else if (subTotal !== null && tooling_items.length > 0 && tooling_total === null) {
      tooling_total = subTotal;
    }
  }
  return { tooling_items, tooling_total };
}

/** label may be "Label:" alone (value in a following non-empty cell) or "Label: value" combined in one cell. */
function findLabeledValue(grid: Grid, labelPrefixes: string[]): string {
  for (const row of grid) {
    for (let c = 0; c < row.length; c++) {
      const cell = cellText(row[c]);
      const cellLower = cell.toLowerCase();
      for (const prefix of labelPrefixes) {
        if (cellLower === prefix || cellLower === `${prefix}:`) {
          for (let n = c + 1; n < row.length; n++) {
            const v = cellText(row[n]);
            if (v) return v;
          }
        } else if (cellLower.startsWith(`${prefix}:`)) {
          const rest = cell.slice(cell.indexOf(":") + 1).trim();
          if (rest) return rest;
        }
      }
    }
  }
  return "";
}

function extractHeader(grid: Grid): { customer: string; program: string; sop: string; annualVolume: number } {
  const customer = findLabeledValue(grid, ["customer"]);
  const program = findLabeledValue(grid, ["program name"]);
  const sop = findLabeledValue(grid, ["estimated sop date"]);
  const eauRaw = findLabeledValue(grid, ["eau"]);
  const annualVolume = cellNumber(eauRaw) ?? 0;
  return { customer, program, sop, annualVolume };
}

function bomRowToLineItem(row: BomTableRow): WorkbookLineItem {
  return {
    item: row.itemNo || row.refDesignation || row.partNumber,
    part_name: row.description || row.partNumber,
    system: row.manufacturer,
    subsystem: row.partNumber,
    level: "",
    material: "",
    process: "",
    target_price: row.targetPrice ?? row.unitPrice,
    tooling: "",
    thickness_mm: null,
    annual_volume: null,
  };
}

function bomRowToBomPartRow(
  row: BomTableRow,
  program: string,
  sheetName: string,
  sourceLabel: string,
): ParsedBomPartRow {
  const ref_designator = row.refDesignation || row.partNumber || row.itemNo || row.description.slice(0, 40);
  const extended: Record<string, string> = {};
  if (row.manufacturer) extended.manufacturer = row.manufacturer;
  if (row.targetPrice != null) extended.target_price = String(row.targetPrice);
  if (row.comments) extended.comments = row.comments;

  return {
    supplier_id: null,
    customer_program: program || null,
    sub_assembly: null,
    ref_designator,
    description: row.description || null,
    quantity: row.qty,
    unit_cost: row.unitPrice ?? row.targetPrice,
    currency: "USD",
    mfr_part_number: row.partNumber || null,
    extended_attributes_json: Object.keys(extended).length > 0 ? JSON.stringify(extended) : null,
    raw_source_ref: `${sourceLabel}!${sheetName}!row${row.rowIndex + 1}`,
  };
}

/**
 * Parses the AAG "single-sheet quote" shape (issue #16): one sheet mixing a header
 * block (Customer, Program Name, EAU, Estimated SOP Date), a BOM line-item table,
 * and a cost-breakdown block (BOM cost, Labor, Overhead & Burden, SG&A, Profit,
 * Packaging cost, FOB Shanghai/Huntsville) plus a small Tooling Cost sub-table.
 *
 * WorkbookHeader has no distinct "program" field — workbookToAgentParsed.ts computes
 * the displayed `program` as `[header.region, header.sop].join(" · ") || header.rfq_id`.
 * This adapter repurposes `region` to carry the program name (not geography) so the
 * combined "<program> · <sop>" display is meaningful; `rfq_id` is left blank since
 * this shape has no distinct RFQ/quote number field to put there instead.
 */
export function parseAagSingleSheetQuote(
  buffer: Buffer,
  sourceLabel = "upload",
): {
  workbook: ParsedRfqWorkbook;
  costElements: AagCostElements;
  bomPartsRows: ParsedBomPartRow[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  let sheetName = wb.SheetNames[0] ?? "";
  let grid: Grid = readGrid(wb, sheetName);
  for (const name of wb.SheetNames) {
    const candidate = readGrid(wb, name);
    if (findHeaderRow(candidate, ["item #", "ref designation"])) {
      sheetName = name;
      grid = candidate;
      break;
    }
  }

  const bomRows = extractBomTableRows(grid);
  const { customer, program, sop, annualVolume } = extractHeader(grid);
  const costBreakdown = extractCostBreakdown(grid);
  const tooling = extractToolingSection(grid);

  const header: WorkbookHeader = {
    rfq_id: "",
    customer,
    region: program,
    annual_volume: annualVolume,
    currency: "USD",
    sop,
  };

  const workbook: ParsedRfqWorkbook = {
    header,
    line_items: bomRows.map(bomRowToLineItem),
    technical_specs: [],
    supplier_responses: [],
    suppliers_grouped: [],
  };

  const costElements: AagCostElements = {
    ...costBreakdown,
    tooling_items: tooling.tooling_items,
    tooling_total: tooling.tooling_total,
  };

  const bomPartsRows = bomRows.map((r) => bomRowToBomPartRow(r, program, sheetName, sourceLabel));

  return { workbook, costElements, bomPartsRows };
}
