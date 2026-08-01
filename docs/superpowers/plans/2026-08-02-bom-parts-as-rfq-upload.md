# BOM-Parts-as-RFQ-Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `README`/`suppliers`/`parts`-shaped workbook (e.g. `docs/sample_supplier_and_part_data.xlsx`) be uploaded through the main RFQ analysis path (same flow as today's 4-sheet RFQ workbooks), surfacing `README`/`suppliers` content in the Overview tab and also populating `bom_parts` so BOM Intelligence and Costing agent show the same parts under the same RFQ.

**Architecture:** A new adapter (`parseBomPartsAsRfqWorkbook.ts`) detects this file shape and produces the same `ParsedRfqWorkbook` type the existing strict 4-sheet parser returns, so the rest of the RFQ pipeline (`workbookToAgentParsed`, matching, gap analysis) works unmodified — plus a separate `extraInfo` array for `README`/`suppliers` content. A second small module (`syncBomPartsFromRfqUpload.ts`) reuses the existing `parseBomPartsWorkbook`/`replaceBomParts` functions to also write `bom_parts` rows. The `analyze-uploaded-workbook` route branches on shape detection before calling either parser, and calls the sync module inside its existing persistence block. `CaseData` gets a new optional `extra_info` field threaded through the single existing `buildCaseDataFromPersisted` choke point, rendered as a new read-only card in the Overview tab (`RfqWorkbookSummaryPanel.tsx`).

**Tech Stack:** TypeScript, `xlsx` package, better-sqlite3, Next.js 16 App Router (Node runtime), React 19, Vitest.

## Global Constraints

- TDD: write the failing test first, watch it fail, then implement (per `CLAUDE.md`), for every task that has automated tests (Tasks 1–3). Tasks 4 has no automated test by design (UI + OpenAI-gated route) — verify via `npm run build` + `npm run lint` + manual walkthrough instead.
- Path alias `@/` maps to `src/`.
- Commits: plain messages only — no Claude co-author/footer.
- Do **not** modify `src/lib/rfq/parseRfqWorkbook.ts` or `src/lib/rfq/workbookToAgentParsed.ts` — both stay exactly as they are today; the adapter produces a type-compatible object instead.
- Do **not** modify `src/lib/rfq/parseBomPartsWorkbook.ts` or `src/lib/rfq/sqlite/bomPartsDb.ts` — reuse `parseBomPartsWorkbook` and `replaceBomParts` exactly as they exist.
- `extra_info` shape everywhere it appears (adapter, `CaseData` type, UI): `{ sheet: string; rows: Record<string, string>[] }[]`.
- This is a spec-driven plan for `docs/superpowers/specs/2026-08-02-bom-parts-as-rfq-upload-design.md` — refer back to it for the "why" behind any decision here.
- **Deviation from the design doc's Testing section, noted deliberately:** the design doc suggested a route-level test on `analyze-uploaded-workbook` for the cross-tab-consistency guarantee. `analyze-uploaded-workbook`'s `POST` handler requires `OPENAI_API_KEY` and makes live network calls partway through (pre-existing, unrelated to this feature), which makes a reliable, fast route-level test impractical. Task 2 extracts the actual side-effect (`maybeSyncBomPartsFromRfqUpload`) into its own directly-testable function and tests it against a real in-memory DB — this covers the same guarantee (a BOM-parts-shaped upload populates `bom_parts`) without depending on OpenAI. The route (Task 4) then just calls this pre-tested function; Task 4 verifies the full integration manually instead.

---

### Task 1: Detection + adapter (`parseBomPartsAsRfqWorkbook.ts`)

**Files:**
- Create: `src/lib/rfq/parseBomPartsAsRfqWorkbook.ts`
- Test: `src/lib/rfq/__tests__/parseBomPartsAsRfqWorkbook.test.ts`

**Interfaces:**
- Consumes: `ParsedRfqWorkbook`, `WorkbookHeader`, `WorkbookLineItem` types from `@/lib/rfq/parseRfqWorkbook` (import as types only — do not call any function from that module).
- Produces: `export type RfqExtraInfoSheet = { sheet: string; rows: Record<string, string>[] }`, `export function looksLikeBomPartsRfqUpload(buffer: Buffer): boolean`, `export function parseBomPartsAsRfqWorkbook(buffer: Buffer): { workbook: ParsedRfqWorkbook; extraInfo: RfqExtraInfoSheet[] }`. Task 3 (route) imports all three; Task 2 imports only `looksLikeBomPartsRfqUpload`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/rfq/__tests__/parseBomPartsAsRfqWorkbook.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { looksLikeBomPartsRfqUpload, parseBomPartsAsRfqWorkbook } from "@/lib/rfq/parseBomPartsAsRfqWorkbook";

function workbookBuffer(sheets: Record<string, Record<string, unknown>[]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("looksLikeBomPartsRfqUpload", () => {
  it("returns true for README + suppliers + parts", () => {
    const buf = workbookBuffer({
      README: [{ Field: "Purpose", Explanation: "..." }],
      suppliers: [{ supplier_id: "AAG" }],
      parts: [{ ref_designator: "R1", description: "Resistor" }],
    });
    expect(looksLikeBomPartsRfqUpload(buf)).toBe(true);
  });

  it("returns true for a parts-only sheet", () => {
    const buf = workbookBuffer({ parts: [{ ref_designator: "R1" }] });
    expect(looksLikeBomPartsRfqUpload(buf)).toBe(true);
  });

  it("returns false for the strict 4-sheet RFQ shape", () => {
    const buf = workbookBuffer({
      Header: [{ rfq_id: "RFQ-1" }],
      Line_Items: [{ item: "L1" }],
      Technical_Specs: [{ part_name: "L1", spec_text: "text" }],
      Supplier_Responses: [{ supplier: "S1", item: "L1" }],
    });
    expect(looksLikeBomPartsRfqUpload(buf)).toBe(false);
  });

  it("returns false when a Header sheet is present alongside parts", () => {
    const buf = workbookBuffer({
      Header: [{ rfq_id: "RFQ-1" }],
      parts: [{ ref_designator: "R1" }],
    });
    expect(looksLikeBomPartsRfqUpload(buf)).toBe(false);
  });

  it("returns false when there is no parts sheet at all", () => {
    const buf = workbookBuffer({ README: [{ Field: "x", Explanation: "y" }] });
    expect(looksLikeBomPartsRfqUpload(buf)).toBe(false);
  });
});

describe("parseBomPartsAsRfqWorkbook", () => {
  it("maps parts rows into line items", () => {
    const buf = workbookBuffer({
      parts: [
        { ref_designator: "R1", description: "Resistor 10k", unit_cost: 0.05 },
        { ref_designator: "C1", description: "Capacitor 100nF", unit_cost: 0.02 },
      ],
    });
    const { workbook } = parseBomPartsAsRfqWorkbook(buf);
    expect(workbook.line_items).toHaveLength(2);
    expect(workbook.line_items[0]).toMatchObject({
      item: "R1",
      part_name: "Resistor 10k",
      target_price: 0.05,
    });
  });

  it("skips parts rows with no ref_designator and no description", () => {
    const buf = workbookBuffer({
      parts: [
        { ref_designator: "", description: "", unit_cost: 1 },
        { ref_designator: "R1", description: "" },
      ],
    });
    const { workbook } = parseBomPartsAsRfqWorkbook(buf);
    expect(workbook.line_items).toHaveLength(1);
    expect(workbook.line_items[0]?.item).toBe("R1");
  });

  it("synthesizes header.rfq_id from the first non-empty customer_program", () => {
    const buf = workbookBuffer({
      parts: [
        { ref_designator: "R1", customer_program: "" },
        { ref_designator: "C1", customer_program: "BM / Latch-ECU (Elatch)" },
      ],
    });
    const { workbook } = parseBomPartsAsRfqWorkbook(buf);
    expect(workbook.header.rfq_id).toBe("BM / Latch-ECU (Elatch)");
    expect(workbook.header.customer).toBe("");
    expect(workbook.header.region).toBe("");
    expect(workbook.header.sop).toBe("");
  });

  it("returns empty technical_specs, supplier_responses, and suppliers_grouped", () => {
    const buf = workbookBuffer({ parts: [{ ref_designator: "R1" }] });
    const { workbook } = parseBomPartsAsRfqWorkbook(buf);
    expect(workbook.technical_specs).toEqual([]);
    expect(workbook.supplier_responses).toEqual([]);
    expect(workbook.suppliers_grouped).toEqual([]);
  });

  it("extracts README and suppliers sheets into extraInfo", () => {
    const buf = workbookBuffer({
      README: [{ Field: "Purpose", Explanation: "Sample file" }],
      suppliers: [{ supplier_id: "AAG", supplier_name: "Advanced Automation Group" }],
      parts: [{ ref_designator: "R1" }],
    });
    const { extraInfo } = parseBomPartsAsRfqWorkbook(buf);
    expect(extraInfo).toHaveLength(2);
    const readme = extraInfo.find((s) => s.sheet === "README");
    expect(readme?.rows).toEqual([{ Field: "Purpose", Explanation: "Sample file" }]);
    const suppliers = extraInfo.find((s) => s.sheet === "suppliers");
    expect(suppliers?.rows).toEqual([{ supplier_id: "AAG", supplier_name: "Advanced Automation Group" }]);
  });

  it("returns an empty extraInfo array when neither README nor suppliers sheets exist", () => {
    const buf = workbookBuffer({ parts: [{ ref_designator: "R1" }] });
    const { extraInfo } = parseBomPartsAsRfqWorkbook(buf);
    expect(extraInfo).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rfq/__tests__/parseBomPartsAsRfqWorkbook.test.ts`
Expected: FAIL — `Cannot find module '@/lib/rfq/parseBomPartsAsRfqWorkbook'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/rfq/parseBomPartsAsRfqWorkbook.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rfq/__tests__/parseBomPartsAsRfqWorkbook.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/rfq/parseBomPartsAsRfqWorkbook.ts src/lib/rfq/__tests__/parseBomPartsAsRfqWorkbook.test.ts
git commit -m "Add adapter to parse BOM-parts-shaped workbooks as RFQ uploads"
```

---

### Task 2: `bom_parts` sync helper

**Files:**
- Create: `src/lib/rfq/syncBomPartsFromRfqUpload.ts`
- Test: `src/lib/rfq/__tests__/syncBomPartsFromRfqUpload.test.ts`

**Interfaces:**
- Consumes: `looksLikeBomPartsRfqUpload` from `@/lib/rfq/parseBomPartsAsRfqWorkbook` (Task 1); `parseBomPartsWorkbook` from `@/lib/rfq/parseBomPartsWorkbook` (existing, unmodified); `replaceBomParts`, `listBomParts` from `@/lib/rfq/sqlite/bomPartsDb` (existing, unmodified).
- Produces: `export function maybeSyncBomPartsFromRfqUpload(buffer: Buffer, rfqFileId: string): void`. Task 4 (route) calls this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/rfq/__tests__/syncBomPartsFromRfqUpload.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import * as XLSX from "xlsx";
import { maybeSyncBomPartsFromRfqUpload } from "@/lib/rfq/syncBomPartsFromRfqUpload";
import { listBomParts } from "@/lib/rfq/sqlite/bomPartsDb";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function workbookBuffer(sheets: Record<string, Record<string, unknown>[]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("maybeSyncBomPartsFromRfqUpload", () => {
  it("populates bom_parts for a BOM-parts-shaped upload", () => {
    const buf = workbookBuffer({
      parts: [
        { ref_designator: "R1", description: "Resistor 10k", quantity: 2, unit_cost: 0.05 },
        { ref_designator: "C1", description: "Capacitor 100nF", quantity: 1, unit_cost: 0.02 },
      ],
    });
    maybeSyncBomPartsFromRfqUpload(buf, "rfq-sync-1");
    const rows = listBomParts("rfq-sync-1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ ref_designator: "R1", description: "Resistor 10k", quantity: 2 });
  });

  it("is a no-op for the strict 4-sheet RFQ shape", () => {
    const buf = workbookBuffer({
      Header: [{ rfq_id: "RFQ-1" }],
      Line_Items: [{ item: "L1" }],
      Technical_Specs: [{ part_name: "L1", spec_text: "text" }],
      Supplier_Responses: [{ supplier: "S1", item: "L1" }],
    });
    maybeSyncBomPartsFromRfqUpload(buf, "rfq-sync-2");
    expect(listBomParts("rfq-sync-2")).toEqual([]);
  });

  it("replaces existing bom_parts rows for the same rfqFileId on re-sync", () => {
    const first = workbookBuffer({ parts: [{ ref_designator: "R1" }] });
    const second = workbookBuffer({ parts: [{ ref_designator: "R2" }] });
    maybeSyncBomPartsFromRfqUpload(first, "rfq-sync-3");
    maybeSyncBomPartsFromRfqUpload(second, "rfq-sync-3");
    const rows = listBomParts("rfq-sync-3");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ref_designator).toBe("R2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rfq/__tests__/syncBomPartsFromRfqUpload.test.ts`
Expected: FAIL — `Cannot find module '@/lib/rfq/syncBomPartsFromRfqUpload'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/rfq/syncBomPartsFromRfqUpload.ts`:

```ts
import { looksLikeBomPartsRfqUpload } from "@/lib/rfq/parseBomPartsAsRfqWorkbook";
import { parseBomPartsWorkbook } from "@/lib/rfq/parseBomPartsWorkbook";
import { replaceBomParts } from "@/lib/rfq/sqlite/bomPartsDb";

/**
 * When an uploaded RFQ workbook is actually BOM-parts-shaped (README/suppliers/parts),
 * also populates bom_parts for this RFQ so BOM Intelligence and Costing agent show the
 * same parts under the same rfq_file_id — one upload, consistent data across every tab.
 * No-op for the strict 4-sheet RFQ shape.
 */
export function maybeSyncBomPartsFromRfqUpload(buffer: Buffer, rfqFileId: string): void {
  if (!looksLikeBomPartsRfqUpload(buffer)) return;
  const { rows } = parseBomPartsWorkbook(buffer);
  replaceBomParts(rfqFileId, rows);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rfq/__tests__/syncBomPartsFromRfqUpload.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/rfq/syncBomPartsFromRfqUpload.ts src/lib/rfq/__tests__/syncBomPartsFromRfqUpload.test.ts
git commit -m "Add bom_parts sync for BOM-parts-shaped RFQ uploads"
```

---

### Task 3: `CaseData.extra_info` + `caseFromPersisted.ts` wiring

**Files:**
- Modify: `src/data/rfqTypes.ts`
- Modify: `src/lib/rfq/caseFromPersisted.ts`
- Test: `src/lib/rfq/__tests__/caseFromPersisted.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–2 directly (this task works off the persisted `parsed` object's `extra_info` key by shape, not by importing `RfqExtraInfoSheet` — kept structurally compatible: `{ sheet: string; rows: Record<string, string>[] }`).
- Produces: `CaseData["extra_info"]: { sheet: string; rows: Record<string, string>[] }[] | undefined`. Task 4's UI reads `c.extra_info`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/rfq/__tests__/caseFromPersisted.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCaseDataFromPersisted } from "@/lib/rfq/caseFromPersisted";
import type { RfqParseSessionFull } from "@/lib/rfq/sqlite/parseSessions";

function baseRow(parsed: Record<string, unknown>): RfqParseSessionFull {
  return {
    session_id: "session-1",
    upload_id: "upload-1",
    original_filename: "test.xlsx",
    stored_filename: "test-stored.xlsx",
    customer_name: null,
    program_name: null,
    part_number: null,
    rfq_reference: null,
    risk_score: 10,
    line_item_count: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    kb_category_slug: null,
    kb_category_label: null,
    part_display_name: null,
    process_family_hint: null,
    parse: {
      mode: "workbook_xlsx",
      model: "workbook_heuristic",
      extractedTextChars: 0,
      parsed,
      raw: "",
    },
    historical: {
      criteria: {},
      matches: [],
    },
    gap: {
      risk_score: 10,
      completeness_status: "pass",
      missing_attachments: [],
      triggered_rules: [],
      summary: "ok",
      recommended_actions: [],
      historical_issues: [],
    },
  } as unknown as RfqParseSessionFull;
}

describe("buildCaseDataFromPersisted extra_info", () => {
  it("passes extra_info through when present on the parsed object", () => {
    const row = baseRow({
      extra_info: [{ sheet: "README", rows: [{ Field: "Purpose", Explanation: "Sample" }] }],
    });
    const c = buildCaseDataFromPersisted(row, { id: "file-1", originalName: "test.xlsx" });
    expect(c.extra_info).toEqual([{ sheet: "README", rows: [{ Field: "Purpose", Explanation: "Sample" }] }]);
  });

  it("is undefined when the parsed object has no extra_info", () => {
    const row = baseRow({});
    const c = buildCaseDataFromPersisted(row, { id: "file-1", originalName: "test.xlsx" });
    expect(c.extra_info).toBeUndefined();
  });

  it("is undefined when extra_info is present but not an array", () => {
    const row = baseRow({ extra_info: "not-an-array" });
    const c = buildCaseDataFromPersisted(row, { id: "file-1", originalName: "test.xlsx" });
    expect(c.extra_info).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rfq/__tests__/caseFromPersisted.test.ts`
Expected: FAIL — `expect(c.extra_info).toEqual(...)` fails because `extra_info` is `undefined` (field doesn't exist on `CaseData` or get set yet).

- [ ] **Step 3: Write the implementation**

In `src/data/rfqTypes.ts`, find the `CaseData` type (starts at line 138) and add a new field right before its closing brace, after `item_historical_comparison?: ItemHistoricalComparison[];`:

```ts
  item_historical_comparison?: ItemHistoricalComparison[];
  /** README/suppliers-style sheets from a BOM-parts-shaped RFQ upload — display only, not matched/gap-analyzed. */
  extra_info?: { sheet: string; rows: Record<string, string>[] }[];
};
```

In `src/lib/rfq/caseFromPersisted.ts`, add this helper function near the other small helpers at the top of the file (after `function num(v: unknown): number { ... }`):

```ts
function extraInfoFromParsed(parsed: Record<string, unknown>): CaseData["extra_info"] {
  const raw = parsed.extra_info;
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(
    (x): x is { sheet: string; rows: Record<string, string>[] } =>
      typeof x === "object" &&
      x !== null &&
      typeof (x as { sheet?: unknown }).sheet === "string" &&
      Array.isArray((x as { rows?: unknown }).rows),
  );
}
```

Then in `buildCaseDataFromPersisted`'s returned object, add a field right after `item_historical_comparison: ...` (before the closing `};` of the return statement):

```ts
          })),
        }))
      : undefined,
    extra_info: extraInfoFromParsed(parsed),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rfq/__tests__/caseFromPersisted.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests pass (previous suite + this task's 3 new tests), no regressions in other `caseFromPersisted`-adjacent behavior (there is no prior test file for this module, so no prior tests to regress — just confirm the full suite is still green).

- [ ] **Step 6: Commit**

```bash
git add src/data/rfqTypes.ts src/lib/rfq/caseFromPersisted.ts src/lib/rfq/__tests__/caseFromPersisted.test.ts
git commit -m "Thread extra_info from parsed workbook through to CaseData"
```

---

### Task 4: Route wiring + Overview UI card

**Files:**
- Modify: `src/app/api/rfq/analyze-uploaded-workbook/route.ts`
- Modify: `src/components/rfq/RfqWorkbookSummaryPanel.tsx`

**Interfaces:**
- Consumes: `looksLikeBomPartsRfqUpload`, `parseBomPartsAsRfqWorkbook`, `type RfqExtraInfoSheet` from `@/lib/rfq/parseBomPartsAsRfqWorkbook` (Task 1); `maybeSyncBomPartsFromRfqUpload` from `@/lib/rfq/syncBomPartsFromRfqUpload` (Task 2); `CaseData["extra_info"]` (Task 3).
- Produces: nothing consumed elsewhere — this is the integration task.

This task has no automated test: the route requires `OPENAI_API_KEY` and makes live network calls partway through (already true today, unrelated to this change), and the UI change is a display-only React card with no existing component-test setup in this repo. Verification is `npm run build` (typecheck) + `npm run lint` + a manual browser walkthrough.

- [ ] **Step 1: Update imports in the route**

In `src/app/api/rfq/analyze-uploaded-workbook/route.ts`, change this line:

```ts
import { parseRfqWorkbook, techSpecForPart } from "@/lib/rfq/parseRfqWorkbook";
```

to:

```ts
import { parseRfqWorkbook, techSpecForPart, type ParsedRfqWorkbook } from "@/lib/rfq/parseRfqWorkbook";
```

Then add two new import lines near it (alongside the other `@/lib/rfq/*` imports):

```ts
import {
  looksLikeBomPartsRfqUpload,
  parseBomPartsAsRfqWorkbook,
  type RfqExtraInfoSheet,
} from "@/lib/rfq/parseBomPartsAsRfqWorkbook";
import { maybeSyncBomPartsFromRfqUpload } from "@/lib/rfq/syncBomPartsFromRfqUpload";
```

- [ ] **Step 2: Branch on shape detection before parsing**

Replace:

```ts
  try {
    const workbook = parseRfqWorkbook(buffer);
    const parsed = workbookToAgentParsed(workbook);
```

with:

```ts
  try {
    let workbook: ParsedRfqWorkbook;
    let extraInfo: RfqExtraInfoSheet[] | null = null;
    if (looksLikeBomPartsRfqUpload(buffer)) {
      const adapted = parseBomPartsAsRfqWorkbook(buffer);
      workbook = adapted.workbook;
      extraInfo = adapted.extraInfo;
    } else {
      workbook = parseRfqWorkbook(buffer);
    }
    const base = workbookToAgentParsed(workbook);
    const parsed = extraInfo !== null ? { ...base, extra_info: extraInfo } : base;
```

Everything below this in the route (`filterSelfKbProjects(bundle.projects, uploadId, parsed)`, `mapParsedToMatchCriteria(parsed)`, etc.) already references `parsed` and `workbook` by name and needs no further changes — both are still the same types they were before.

- [ ] **Step 3: Sync `bom_parts` in the persistence block**

Find this block (inside the `if (uploadId && originalName)` section):

```ts
        try {
          upsertKnowledgeBaseFromUpload({
            sessionId: uploadId,
            parsed: parse.parsed,
            originalFilename: originalName,
            source: "workbook",
          });
        } catch (kbErr) {
          console.error("[analyze-uploaded-workbook] knowledge base append", kbErr);
        }
```

Add a new sibling `try`/`catch` immediately after it (still inside the outer `try` block, before its closing brace):

```ts
        try {
          upsertKnowledgeBaseFromUpload({
            sessionId: uploadId,
            parsed: parse.parsed,
            originalFilename: originalName,
            source: "workbook",
          });
        } catch (kbErr) {
          console.error("[analyze-uploaded-workbook] knowledge base append", kbErr);
        }
        try {
          maybeSyncBomPartsFromRfqUpload(buffer, uploadId);
        } catch (bomErr) {
          console.error("[analyze-uploaded-workbook] bom_parts sync", bomErr);
        }
```

- [ ] **Step 4: Add the Overview card**

In `src/components/rfq/RfqWorkbookSummaryPanel.tsx`, find the end of the component's returned JSX:

```tsx
        </Card>
      </div>
    </div>
  );
}
```

(this is the closing of the two-card `grid grid-cols-1 lg:grid-cols-2 gap-4` div, followed by the closing of the outer `space-y-4` div). Replace it with:

```tsx
        </Card>
      </div>

      {c.extra_info && c.extra_info.length > 0 ? (
        <Card className="bg-card/45 border-border">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
              Additional Sheet Data
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {c.extra_info.map((sheet) => {
              const columns = sheet.rows.length > 0 ? Object.keys(sheet.rows[0]!) : [];
              return (
                <div key={sheet.sheet}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {sheet.sheet}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-background/20">
                          {columns.map((col) => (
                            <th key={col} className="text-left px-3 py-2 font-semibold text-muted-foreground">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.rows.map((row, i) => (
                          <tr key={i} className="border-t border-border">
                            {columns.map((col) => (
                              <td key={col} className="px-3 py-2 align-top text-foreground">
                                {row[col] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run build`
Expected: build succeeds with no new TypeScript errors.

Run: `npm run lint`
Expected: no new warnings in the two files touched by this task.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests pass (no regressions — this task added no new test files, but confirms Tasks 1–3 still integrate cleanly with the modified route/UI files at the type level via the build step above).

- [ ] **Step 7: Manual verification in the browser**

Requires `OPENAI_API_KEY` set in `.env.local` (already required for any workbook analysis — see `CLAUDE.md`).

Run: `npm run dev`

1. Open the app, log in, go to the "Processing" (analysis) workspace, and upload `docs/sample_supplier_and_part_data.xlsx`.
2. Confirm the upload succeeds (previously this would fail with "Workbook must include sheets: Header, Line_Items, Technical_Specs, Supplier_Responses").
3. On the Overview tab, confirm a new "Additional Sheet Data" card appears showing a "README" table (6 rows, Field/Explanation columns) and a "suppliers" table (1 row: AAG / Advanced Automation Group / ...).
4. Navigate to BOM Intelligence for this same RFQ — confirm it shows 70 parsed parts rows (from the `parts` sheet), the same ones visible via a direct BOM Intelligence upload today.
5. Confirm those rows are inline-editable (issue #17's feature) and that Costing agent for this RFQ reflects them.
6. As a regression check, upload an existing 4-sheet `.xlsx` RFQ workbook (any that worked before this change) and confirm it still analyzes correctly with no "Additional Sheet Data" card (since `extra_info` is only set for the BOM-parts shape).

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/rfq/analyze-uploaded-workbook/route.ts" src/components/rfq/RfqWorkbookSummaryPanel.tsx
git commit -m "Route BOM-parts-shaped uploads through the RFQ pipeline with Overview display"
```
