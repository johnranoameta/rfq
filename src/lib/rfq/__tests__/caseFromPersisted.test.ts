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

describe("buildCaseDataFromPersisted cost_elements", () => {
  it("passes cost_elements through when present on the parsed object", () => {
    const row = baseRow({
      cost_elements: {
        bom_cost: 1.0643,
        loss_rate: 0.0034,
        labor: 0.1054,
        overhead_burden: 0.1204,
        sga: 0.0996,
        profit: 0.0594,
        packaging_cost: 0.04,
        fob_shanghai: 1.4925,
        fob_huntsville: 1.4925,
        tooling_items: [{ description: "PCB Tooling", sub_total: 400 }],
        tooling_total: 750,
      },
    });
    const c = buildCaseDataFromPersisted(row, { id: "file-1", originalName: "test.xlsx" });
    expect(c.cost_elements).toEqual({
      bom_cost: 1.0643,
      loss_rate: 0.0034,
      labor: 0.1054,
      overhead_burden: 0.1204,
      sga: 0.0996,
      profit: 0.0594,
      packaging_cost: 0.04,
      fob_shanghai: 1.4925,
      fob_huntsville: 1.4925,
      tooling_items: [{ description: "PCB Tooling", sub_total: 400 }],
      tooling_total: 750,
    });
  });

  it("is undefined when the parsed object has no cost_elements", () => {
    const row = baseRow({});
    const c = buildCaseDataFromPersisted(row, { id: "file-1", originalName: "test.xlsx" });
    expect(c.cost_elements).toBeUndefined();
  });

  it("drops malformed tooling_items entries and nulls out non-numeric cost fields", () => {
    const row = baseRow({
      cost_elements: {
        bom_cost: "not-a-number",
        tooling_items: [{ description: "", sub_total: 5 }, { description: "Valid", sub_total: "x" }],
      },
    });
    const c = buildCaseDataFromPersisted(row, { id: "file-1", originalName: "test.xlsx" });
    expect(c.cost_elements?.bom_cost).toBeNull();
    expect(c.cost_elements?.tooling_items).toEqual([{ description: "Valid", sub_total: null }]);
  });
});
