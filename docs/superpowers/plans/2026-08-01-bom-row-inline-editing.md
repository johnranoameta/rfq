# BOM Row Inline Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user inline-edit the 7 fields of a parsed BOM Intelligence row (`bom_parts`) after upload, with autosave on blur, instead of requiring a full workbook re-upload to fix a bad parse.

**Architecture:** A pure validation module (`bomPartFieldValidation.ts`) defines the field whitelist and per-field rules and is unit-tested directly. A DB function (`updateBomPartField`) re-checks the whitelist at the SQL boundary and does a single-column `UPDATE`. A new `PATCH /api/rfq/bom-parts/[id]` route wires request parsing → validation → DB update → JSON response. The UI adds an `EditableCell` component used for all 7 columns in `RfqWorkbookBomPanel.tsx`'s existing table; each cell autosaves on blur and reloads the shared `useBomParts` state on success.

**Tech Stack:** Next.js 16 App Router (Node runtime), TypeScript, better-sqlite3, Vitest, React 19 client component.

## Global Constraints

- TDD: write the failing test first, watch it fail, then implement (per `CLAUDE.md`).
- Path alias `@/` maps to `src/`.
- Commits: plain messages only — do **not** add a Claude co-author footer (per `CLAUDE.md`, this repo's convention overrides the default git-commit template).
- API routes are Node runtime: `export const runtime = "nodejs";`.
- This is GitHub issue [#17](https://github.com/johnranoameta/rfq/issues/17) — v1 scope only: no audit trail, no original-value tracking, simple overwrite on save.
- Editable fields (exactly these 7, nothing else): `ref_designator`, `description`, `sub_assembly`, `customer_program`, `quantity`, `unit_cost`, `mfr_part_number`.

---

### Task 1: Pure field-validation module

**Files:**
- Create: `src/lib/rfq/bomPartFieldValidation.ts`
- Test: `src/lib/rfq/__tests__/bomPartFieldValidation.test.ts`

**Interfaces:**
- Produces: `EDITABLE_BOM_PART_FIELDS: readonly string[]`, `type EditableBomPartField`, `isEditableBomPartField(field: string): field is EditableBomPartField`, `type BomPartFieldValidationResult = { ok: true; value: string | number | null } | { ok: false; error: string }`, `validateBomPartFieldValue(field: EditableBomPartField, raw: unknown): BomPartFieldValidationResult`. Task 2 and Task 3 both import from this module.

- [ ] **Step 1: Write the failing test**

Create `src/lib/rfq/__tests__/bomPartFieldValidation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  EDITABLE_BOM_PART_FIELDS,
  isEditableBomPartField,
  validateBomPartFieldValue,
} from "@/lib/rfq/bomPartFieldValidation";

describe("isEditableBomPartField", () => {
  it("accepts every field in the whitelist", () => {
    for (const field of EDITABLE_BOM_PART_FIELDS) {
      expect(isEditableBomPartField(field)).toBe(true);
    }
  });

  it("rejects a field outside the whitelist", () => {
    expect(isEditableBomPartField("rfq_file_id")).toBe(false);
    expect(isEditableBomPartField("id")).toBe(false);
    expect(isEditableBomPartField("extended_attributes_json")).toBe(false);
  });
});

describe("validateBomPartFieldValue", () => {
  it("accepts a valid non-negative number for quantity", () => {
    expect(validateBomPartFieldValue("quantity", "12")).toEqual({ ok: true, value: 12 });
  });

  it("accepts a valid non-negative number for unit_cost", () => {
    expect(validateBomPartFieldValue("unit_cost", "1.5")).toEqual({ ok: true, value: 1.5 });
  });

  it("treats an empty numeric value as null", () => {
    expect(validateBomPartFieldValue("quantity", "")).toEqual({ ok: true, value: null });
    expect(validateBomPartFieldValue("unit_cost", "")).toEqual({ ok: true, value: null });
  });

  it("rejects a negative number", () => {
    const result = validateBomPartFieldValue("quantity", "-1");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-numeric value", () => {
    const result = validateBomPartFieldValue("unit_cost", "not-a-number");
    expect(result.ok).toBe(false);
  });

  it("requires ref_designator to be non-empty", () => {
    const result = validateBomPartFieldValue("ref_designator", "  ");
    expect(result.ok).toBe(false);
  });

  it("trims and keeps a non-empty ref_designator", () => {
    expect(validateBomPartFieldValue("ref_designator", "  R1  ")).toEqual({ ok: true, value: "R1" });
  });

  it("treats an empty free-text field as null", () => {
    expect(validateBomPartFieldValue("description", "")).toEqual({ ok: true, value: null });
    expect(validateBomPartFieldValue("mfr_part_number", "   ")).toEqual({ ok: true, value: null });
  });

  it("trims free-text fields", () => {
    expect(validateBomPartFieldValue("sub_assembly", "  LATCH ECU  ")).toEqual({
      ok: true,
      value: "LATCH ECU",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rfq/__tests__/bomPartFieldValidation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/rfq/bomPartFieldValidation'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/rfq/bomPartFieldValidation.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rfq/__tests__/bomPartFieldValidation.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/rfq/bomPartFieldValidation.ts src/lib/rfq/__tests__/bomPartFieldValidation.test.ts
git commit -m "Add BOM part field editability whitelist and validation"
```

---

### Task 2: `updateBomPartField` DB function

**Files:**
- Modify: `src/lib/rfq/sqlite/bomPartsDb.ts`
- Test: `src/lib/rfq/__tests__/bomPartsDb.test.ts`

**Interfaces:**
- Consumes: `EditableBomPartField`, `isEditableBomPartField` from `@/lib/rfq/bomPartFieldValidation` (Task 1). `getRfqDb()` from `@/lib/rfq/sqlite/rfqDb`. `BomPartRow` from `@/lib/rfq/costLookupTypes`.
- Produces: `updateBomPartField(id: number, field: EditableBomPartField, value: string | number | null): BomPartRow | null`. Task 3's route calls this directly.

- [ ] **Step 1: Write the failing test**

Create `src/lib/rfq/__tests__/bomPartsDb.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { updateBomPartField } from "@/lib/rfq/sqlite/bomPartsDb";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";
import type { EditableBomPartField } from "@/lib/rfq/bomPartFieldValidation";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function insertRow(): number {
  const db = getRfqDb();
  const info = db
    .prepare(
      `INSERT INTO bom_parts (rfq_file_id, ref_designator, description, quantity, unit_cost, currency)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run("file-1", "R1", "resistor", 2, 1.5, "USD");
  return Number(info.lastInsertRowid);
}

describe("updateBomPartField", () => {
  it("updates a text field", () => {
    const id = insertRow();
    const row = updateBomPartField(id, "description", "updated resistor");
    expect(row?.description).toBe("updated resistor");
  });

  it("updates a numeric field", () => {
    const id = insertRow();
    const row = updateBomPartField(id, "unit_cost", 3.25);
    expect(row?.unit_cost).toBe(3.25);
  });

  it("sets a numeric field to null", () => {
    const id = insertRow();
    const row = updateBomPartField(id, "quantity", null);
    expect(row?.quantity).toBeNull();
  });

  it("returns null when the row does not exist", () => {
    const row = updateBomPartField(999999, "description", "x");
    expect(row).toBeNull();
  });

  it("rejects a field outside the editable whitelist", () => {
    const id = insertRow();
    expect(() => updateBomPartField(id, "rfq_file_id" as EditableBomPartField, "hacked")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rfq/__tests__/bomPartsDb.test.ts`
Expected: FAIL — `updateBomPartField is not a function` / not exported yet.

- [ ] **Step 3: Write the implementation**

In `src/lib/rfq/sqlite/bomPartsDb.ts`, add the import and the new function (append after `replaceBomParts`):

```ts
import { isEditableBomPartField, type EditableBomPartField } from "@/lib/rfq/bomPartFieldValidation";
```

(add this alongside the existing imports at the top of the file)

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rfq/__tests__/bomPartsDb.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/rfq/sqlite/bomPartsDb.ts src/lib/rfq/__tests__/bomPartsDb.test.ts
git commit -m "Add updateBomPartField for BOM row inline editing"
```

---

### Task 3: `PATCH /api/rfq/bom-parts/[id]` route

**Files:**
- Create: `src/app/api/rfq/bom-parts/[id]/route.ts`
- Test: `src/app/api/rfq/bom-parts/[id]/route.test.ts`

**Interfaces:**
- Consumes: `isEditableBomPartField`, `validateBomPartFieldValue` from `@/lib/rfq/bomPartFieldValidation` (Task 1); `updateBomPartField` from `@/lib/rfq/sqlite/bomPartsDb` (Task 2).
- Produces: `PATCH(request: Request, ctx: { params: Promise<{ id: string }> })` — Next.js route handler. Task 4's UI calls this via `fetch(\`/api/rfq/bom-parts/${id}\`, { method: "PATCH", body: JSON.stringify({ field, value }) })`, expecting `{ row: BomPartRow }` on 200 or `{ error: string }` on 400/404/503.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/rfq/bom-parts/[id]/route.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { PATCH } from "./route";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function insertRow(): number {
  const db = getRfqDb();
  const info = db
    .prepare(
      `INSERT INTO bom_parts (rfq_file_id, ref_designator, description, quantity, unit_cost, currency)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run("file-1", "R1", "resistor", 2, 1.5, "USD");
  return Number(info.lastInsertRowid);
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/rfq/bom-parts/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/rfq/bom-parts/[id]", () => {
  it("updates a whitelisted field and returns the updated row", async () => {
    const id = insertRow();
    const res = await PATCH(patchRequest({ field: "description", value: "new description" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.row.description).toBe("new description");
  });

  it("rejects a field outside the whitelist with 400", async () => {
    const id = insertRow();
    const res = await PATCH(patchRequest({ field: "rfq_file_id", value: "hacked" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric value for a numeric field with 400", async () => {
    const id = insertRow();
    const res = await PATCH(patchRequest({ field: "unit_cost", value: "not-a-number" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an empty ref_designator with 400", async () => {
    const id = insertRow();
    const res = await PATCH(patchRequest({ field: "ref_designator", value: "" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the row does not exist", async () => {
    const res = await PATCH(patchRequest({ field: "description", value: "x" }), {
      params: Promise.resolve({ id: "999999" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const res = await PATCH(patchRequest({ field: "description", value: "x" }), {
      params: Promise.resolve({ id: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/rfq/bom-parts/[id]/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"` (route file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/app/api/rfq/bom-parts/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { isEditableBomPartField, validateBomPartFieldValue } from "@/lib/rfq/bomPartFieldValidation";
import { updateBomPartField } from "@/lib/rfq/sqlite/bomPartsDb";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/** Updates one whitelisted field on a bom_parts row — backs BOM Intelligence's inline cell editing (issue #17). */
export async function PATCH(request: Request, ctx: RouteParams) {
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { field?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const field = body.field;
  if (typeof field !== "string" || !isEditableBomPartField(field)) {
    return NextResponse.json({ error: `Field "${String(field)}" is not editable` }, { status: 400 });
  }

  const validation = validateBomPartFieldValue(field, body.value);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const row = updateBomPartField(id, field, validation.value);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update BOM part";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/rfq/bom-parts/[id]/route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/rfq/bom-parts/[id]/route.ts" "src/app/api/rfq/bom-parts/[id]/route.test.ts"
git commit -m "Add PATCH /api/rfq/bom-parts/[id] for BOM row inline editing"
```

---

### Task 4: Inline-editable cells in `RfqWorkbookBomPanel.tsx`

**Files:**
- Modify: `src/components/rfq/RfqWorkbookBomPanel.tsx`
- Modify: `src/components/rfq/rfq-assistant.css`

**Interfaces:**
- Consumes: `type EditableBomPartField` from `@/lib/rfq/bomPartFieldValidation` (Task 1); the `PATCH /api/rfq/bom-parts/[id]` route from Task 3; `reload` (already returned by the existing `useBomParts` hook — no hook changes needed).
- Produces: nothing consumed elsewhere — this is the leaf UI change.

This task has no automated test (UI-only change to a client component with no existing component-test setup in this repo — consistent with `CLAUDE.md`'s "pure domain logic in `src/lib/rfq` is the testable seam"). Verify manually per Step 4 below.

- [ ] **Step 1: Add the CSS for editable cells**

In `src/components/rfq/rfq-assistant.css`, insert immediately after the `.ra-table td { ... }` rule (currently ending at line 1032):

```css
.ra-cell-input {
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ra-text);
  font: inherit;
  padding: 2px 4px;
  border-radius: 4px;
}

.ra-cell-input:hover,
.ra-cell-input:focus {
  border-color: var(--ra-border);
  background: var(--ra-bg);
  outline: none;
}

.ra-cell-input-error {
  border-color: var(--ra-red);
}
```

- [ ] **Step 2: Update imports and add the `EditableCell` component**

In `src/components/rfq/RfqWorkbookBomPanel.tsx`, replace the top of the file:

```tsx
"use client";

import { useId, useMemo, useRef } from "react";
import { useBomParts } from "@/lib/rfq/useBomParts";
```

with:

```tsx
"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { BomPartRow } from "@/lib/rfq/costLookupTypes";
import type { EditableBomPartField } from "@/lib/rfq/bomPartFieldValidation";
import { useBomParts } from "@/lib/rfq/useBomParts";

function EditableCell({
  value,
  numeric = false,
  onSave,
}: {
  value: string;
  numeric?: boolean;
  onSave: (raw: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = async () => {
    if (draft === value) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <input
        type={numeric ? "number" : "text"}
        className={["ra-cell-input", error ? "ra-cell-input-error" : ""].join(" ")}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
      />
      {error ? <div className="text-[11px] text-[var(--ra-red)] mt-1">{error}</div> : null}
    </div>
  );
}
```

- [ ] **Step 3: Wire up `saveField` and replace the table body**

In `RfqWorkbookBomPanel`, replace:

```tsx
const { rows, loading, error, uploadBusy, uploadMessage, upload } = useBomParts(fileId);
```

with:

```tsx
const { rows, loading, error, uploadBusy, uploadMessage, upload, reload } = useBomParts(fileId);

const saveField = useCallback(
  async (id: number, field: EditableBomPartField, raw: string) => {
    const res = await fetch(`/api/rfq/bom-parts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value: raw }),
    });
    const json = (await res.json()) as { row?: BomPartRow; error?: string };
    if (!res.ok) throw new Error(json.error || `Save failed (${res.status})`);
    await reload();
  },
  [reload],
);
```

Then replace the table body (`{rows.map((r, i) => ( ... ))}` inside the "Uploaded BOM" card):

```tsx
{rows.map((r, i) => (
  <tr key={r.id}>
    <td className="ra-mono">{i + 1}</td>
    <td>
      <div className="font-medium">{r.description || r.ref_designator}</div>
      <div className="text-[11px] text-[var(--ra-muted)]">as supplied: &ldquo;{r.ref_designator}&rdquo;</div>
    </td>
    <td className="text-[var(--ra-mid)]">
      {r.sub_assembly || "—"}
      {r.customer_program ? (
        <div className="text-[11px] text-[var(--ra-muted)]">{r.customer_program}</div>
      ) : null}
    </td>
    <td className="ra-mono">{r.quantity ?? "—"}</td>
    <td className="ra-mono">
      {r.unit_cost != null ? `${r.currency} ${r.unit_cost.toFixed(4)}` : "—"}
    </td>
    <td>
      {r.mfr_part_number ? (
        <span className="ra-badge ra-badge-g">MPN: {r.mfr_part_number}</span>
      ) : (
        <span className="ra-badge ra-badge-r">No manufacturer part number</span>
      )}
    </td>
  </tr>
))}
```

with:

```tsx
{rows.map((r, i) => (
  <tr key={r.id}>
    <td className="ra-mono">{i + 1}</td>
    <td>
      <EditableCell value={r.description ?? ""} onSave={(v) => saveField(r.id, "description", v)} />
      <div className="text-[11px] text-[var(--ra-muted)] mt-1">
        as supplied: <EditableCell value={r.ref_designator} onSave={(v) => saveField(r.id, "ref_designator", v)} />
      </div>
    </td>
    <td className="text-[var(--ra-mid)]">
      <EditableCell value={r.sub_assembly ?? ""} onSave={(v) => saveField(r.id, "sub_assembly", v)} />
      <div className="mt-1">
        <EditableCell value={r.customer_program ?? ""} onSave={(v) => saveField(r.id, "customer_program", v)} />
      </div>
    </td>
    <td className="ra-mono">
      <EditableCell
        value={r.quantity != null ? String(r.quantity) : ""}
        numeric
        onSave={(v) => saveField(r.id, "quantity", v)}
      />
    </td>
    <td className="ra-mono">
      <EditableCell
        value={r.unit_cost != null ? String(r.unit_cost) : ""}
        numeric
        onSave={(v) => saveField(r.id, "unit_cost", v)}
      />
    </td>
    <td>
      {r.mfr_part_number ? (
        <span className="ra-badge ra-badge-g">MPN: {r.mfr_part_number}</span>
      ) : (
        <span className="ra-badge ra-badge-r">No manufacturer part number</span>
      )}
      <div className="mt-1">
        <EditableCell value={r.mfr_part_number ?? ""} onSave={(v) => saveField(r.id, "mfr_part_number", v)} />
      </div>
    </td>
  </tr>
))}
```

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`

1. Open `http://localhost:3000`, log in, navigate to an RFQ's BOM Intelligence tab (upload a BOM workbook first if none exists — see `docs/sample_supplier_and_part_data.xlsx` for the expected shape, or use `npm run sample-workbooks` to generate one).
2. Click into the Description cell of a row, change the text, press Tab/click away — confirm no error appears and the value persists after a page reload.
3. Repeat for Qty and Unit cost with a valid number, then try a non-numeric value (e.g. `"abc"`) — confirm an inline error appears under the cell and the typed value is not silently reverted.
4. Try clearing `ref_designator` to empty and blurring — confirm an inline error appears ("ref_designator is required") and the row is not saved as empty.
5. Edit `mfr_part_number` on a row that previously showed the red "No manufacturer part number" badge — confirm after reload the badge turns green with the new MPN.
6. Switch to the Costing agent tab for the same RFQ — confirm it reflects the edited `mfr_part_number`/`unit_cost` (it refetches BOM rows on mount).

- [ ] **Step 5: Run the full test suite and lint**

Run: `npm test`
Expected: all tests pass, including the 21 new tests from Tasks 1–3.

Run: `npm run lint`
Expected: no new warnings in the files touched by this plan.

- [ ] **Step 6: Commit**

```bash
git add src/components/rfq/RfqWorkbookBomPanel.tsx src/components/rfq/rfq-assistant.css
git commit -m "Make BOM Intelligence row fields inline-editable"
```
