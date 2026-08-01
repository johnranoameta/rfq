# BOM-Parts-as-RFQ-Upload Design

## Context

`docs/sample_supplier_and_part_data.xlsx` (and files shaped like it) has 3 sheets: `README` (schema documentation, not RFQ data), `suppliers` (one row per supplier: supplier_id, supplier_name, source_type, programs_quoted, notes), and `parts` (the BOM line data — supplier_id, customer_program, sub_assembly, ref_designator, description, quantity, unit_cost, currency, extended_attributes_json, raw_source_ref).

Today this file shape can only be uploaded through **BOM Intelligence** (`parseBomPartsWorkbook.ts` → `bom_parts` table), which reads only the `parts` sheet and silently discards `README` and `suppliers`. It cannot be uploaded through the main **RFQ analysis pipeline** (`parseRfqWorkbook.ts` → `workbookToAgentParsed.ts` → `CaseData` → historical matching + gap analysis + quote) at all — that parser hard-requires 4 sheets named/aliased `Header`, `Line_Items`, `Technical_Specs`, `Supplier_Responses`, and throws if any are missing.

## Goal

Uploading a `README`/`suppliers`/`parts`-shaped file as an RFQ should:
1. Run it through the full RFQ analysis pipeline (matching, gap analysis, quote) using the `parts` sheet as line items.
2. Surface `README` and `suppliers` content somewhere visible (the Overview tab) instead of dropping it, without forcing it into fields it doesn't fit (no forced mapping into `Supplier_Responses`).
3. Also populate `bom_parts` for the same RFQ from the same upload, so **BOM Intelligence** and **Costing agent** show and can edit the same parts — one file, one `rfq_file_id`, consistent data across every tab when the user switches between Overview / Matching / Gap analysis / Quote / BOM Intelligence / Costing agent for that RFQ.

This does not change the existing 4-sheet RFQ upload path or the standalone BOM Intelligence upload path — both keep working exactly as they do today. This is strictly additive: a new shape becomes accepted where before it was rejected (RFQ path) or partially silently dropped (BOM Intelligence path already existed and is untouched).

## Non-goals

- No change to `parseRfqWorkbook.ts`'s 4-sheet detection/parsing logic.
- No change to `parseBomPartsWorkbook.ts`.
- No attempt to map `suppliers` sheet data into `Supplier_Responses`-shaped records (quoted_price/lead_time/assumptions) — the shapes don't fit and forcing it would fabricate data that isn't in the file.
- No audit trail or edit history for anything in this feature.

## Architecture

### 1. Detection

`looksLikeBomPartsRfqUpload(buffer: Buffer): boolean` in the new adapter module. Reads the workbook's sheet names (case-insensitive, trimmed) and returns true when a `parts` sheet is present and no `Header` or `Line_Items` sheet is present (i.e., this is not the 4-sheet shape). `README` and `suppliers` are read if present but their absence doesn't disqualify the shape (a `parts`-only upload with neither still counts, since the "quick" nature of this feature doesn't need to be strict about the other two sheets — them being missing just means no `extraInfo` entries).

### 2. Adapter — `src/lib/rfq/parseBomPartsAsRfqWorkbook.ts`

```ts
export type RfqExtraInfoSheet = {
  sheet: string;
  rows: Record<string, string>[];
};

export function looksLikeBomPartsRfqUpload(buffer: Buffer): boolean;

export function parseBomPartsAsRfqWorkbook(buffer: Buffer): {
  workbook: ParsedRfqWorkbook; // same type parseRfqWorkbook.ts returns
  extraInfo: RfqExtraInfoSheet[];
};
```

- **Line items**: one `WorkbookLineItem` per `parts` row. `item` ← `ref_designator`, `part_name` ← `description`, `target_price` ← `unit_cost` (parsed as a number). `system`, `subsystem`, `level`, `material`, `process`, `tooling` ← `""`. `thickness_mm`, `annual_volume` ← `null`. Rows with no `ref_designator` and no `description` are skipped (same skip rule as `parseBomPartsWorkbook.ts`).
- **Header**: `customer: ""`, `program:` the first non-empty `customer_program` value found across `parts` rows (best-effort label, not a real customer field — this shape has none), `region: ""`, `annual_volume: 0`, `currency: "USD"`, `sop: ""`. `rfq_id: ""`.
- **`technical_specs`**: `[]`. **`supplier_responses`**: `[]`. **`suppliers_grouped`**: `[]` (derived from the empty array, same as `parseRfqWorkbook.ts`'s own `groupBySupplier` on an empty list).
- **`extraInfo`**: one `RfqExtraInfoSheet` per `README` and `suppliers` sheet found, each `rows` being every row from that sheet read as `Record<string, string>` (raw column headers as keys, matching how the sheet actually looks in Excel — no field renaming, no interpretation).

### 3. Route wiring — `src/app/api/rfq/analyze-uploaded-workbook/route.ts`

Before calling `parseRfqWorkbook(buffer)`, check `looksLikeBomPartsRfqUpload(buffer)`:
- If true: call `parseBomPartsAsRfqWorkbook(buffer)` to get `{ workbook, extraInfo }`, use `workbook` everywhere `parseRfqWorkbook`'s result is used today (unchanged downstream: `workbookToAgentParsed`, `techSpecForPart`, matching, gap analysis). After building `const base = workbookToAgentParsed(workbook)`, construct `const parsed = { ...base, extra_info: extraInfo }` (a new object via spread — `workbookToAgentParsed`'s return value itself is never mutated) and use `parsed` everywhere downstream in place of `base`.
- If false: call `parseRfqWorkbook(buffer)` exactly as today. No `extra_info` is attached (existing `parsed` objects for 4-sheet uploads are untouched, no new key appears).
- **Also, when the detected shape is true and `uploadId` is present** (same condition already used for `upsertRfqParseSession`): call `parseBomPartsWorkbook(buffer)` (existing, unmodified function) and `replaceBomParts(uploadId, rows)` (existing, unmodified function from `bomPartsDb.ts`), using `uploadId` as the `rfq_file_id` — the same identifier this RFQ is persisted under. This is what makes BOM Intelligence and Costing agent show the same parts under this RFQ's tabs. If `uploadId` is absent, skip this step silently (matches the existing pattern where `upsertRfqParseSession` is also skipped when `uploadId`/`originalName` are missing — this only happens for a preview/dry-run call, not a real saved upload).

### 4. `CaseData` — `src/data/rfqTypes.ts` and `src/lib/rfq/caseFromPersisted.ts`

Add `extra_info?: { sheet: string; rows: Record<string, string>[] }[]` to the `CaseData` type. In `buildCaseDataFromPersisted`, add `extra_info: Array.isArray(parsed.extra_info) ? (parsed.extra_info as CaseData["extra_info"]) : undefined` to the returned object. This is the single choke point all persisted sessions go through, so no other call site needs changes.

### 5. Overview rendering — `src/components/rfq/RfqWorkbookSummaryPanel.tsx`

When `c.extra_info` is present and non-empty, render one additional card below the existing two-column grid: one block per `RfqExtraInfoSheet` entry, titled with the sheet name (e.g. "README", "suppliers"), showing its rows as a simple read-only table (columns = the keys present in that sheet's rows). No interaction, no editing — purely informational, consistent with how this data is presented (documentation/reference, not actionable RFQ fields).

### 6. Cross-tab consistency

Because both the RFQ `CaseData` (via `upsertRfqParseSession`) and `bom_parts` (via `replaceBomParts`) are keyed on the same `uploadId`/`rfq_file_id` from one upload, switching between Overview / Matching / Gap analysis / Quote (driven by `CaseData`) and BOM Intelligence / Costing agent (driven by `bom_parts` via `useBomParts(fileId)`) shows data from the same single upload throughout — no separate BOM upload step needed for files of this shape.

## Testing

- Unit tests for `looksLikeBomPartsRfqUpload` (true for README+suppliers+parts, true for parts-only, false for the existing 4-sheet fixture shape).
- Unit tests for `parseBomPartsAsRfqWorkbook` (line item mapping from `parts` rows, header synthesis from `customer_program`, `extraInfo` extraction from `README`/`suppliers`, empty `extraInfo` when neither sheet exists).
- Route-level test on `analyze-uploaded-workbook`: given a README+suppliers+parts buffer and an `uploadId`, confirm `replaceBomParts` is called (or, more precisely, confirm a subsequent `listBomParts(uploadId)` call returns the expected rows) alongside the normal gap/matching response — this is the cross-tab-consistency guarantee and deserves direct test coverage, not just unit coverage of the pieces.
- Manual verification: upload `docs/sample_supplier_and_part_data.xlsx` as an RFQ, confirm Overview shows README/suppliers cards, confirm BOM Intelligence tab for the same RFQ shows the same 70 parts rows and they're editable (issue #17), confirm the existing 4-sheet upload path still works unchanged (regression check).
