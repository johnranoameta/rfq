import { describe, it, expect } from "vitest";
import { buildGapAnalysisFromWorkbook } from "@/lib/rfq/gapFromWorkbook";
import type { ParsedRfqWorkbook, WorkbookLineItem } from "@/lib/rfq/parseRfqWorkbook";

function lineItem(overrides: Partial<WorkbookLineItem> = {}): WorkbookLineItem {
  return {
    item: "L1",
    part_name: "Widget",
    system: "",
    subsystem: "",
    level: "",
    material: "",
    process: "",
    target_price: null,
    tooling: "",
    thickness_mm: null,
    annual_volume: null,
    ...overrides,
  };
}

function workbook(overrides: Partial<ParsedRfqWorkbook> = {}): ParsedRfqWorkbook {
  return {
    header: { rfq_id: "RFQ-1", customer: "", region: "", annual_volume: 0, currency: "USD", sop: "" },
    line_items: [],
    technical_specs: [],
    supplier_responses: [],
    suppliers_grouped: [],
    ...overrides,
  };
}

describe("buildGapAnalysisFromWorkbook", () => {
  it("emits exactly one Technical_Specs finding when technical_specs is empty, regardless of line item count", () => {
    const w = workbook({
      line_items: [
        lineItem({ item: "L1", part_name: "Widget A" }),
        lineItem({ item: "L2", part_name: "Widget B" }),
        lineItem({ item: "L3", part_name: "Widget C" }),
      ],
      technical_specs: [],
    });
    const result = buildGapAnalysisFromWorkbook(w, [], []);
    const specFindings = result.missing_attachments.filter((m) => m.startsWith("Technical_Specs"));
    expect(specFindings).toHaveLength(1);
    expect(specFindings[0]).toBe("Technical_Specs: no specifications sheet provided for this upload");
  });

  it("does not emit a Technical_Specs finding when there are no line items and no specs", () => {
    const w = workbook({ line_items: [], technical_specs: [] });
    const result = buildGapAnalysisFromWorkbook(w, [], []);
    const specFindings = result.missing_attachments.filter((m) => m.startsWith("Technical_Specs"));
    expect(specFindings).toHaveLength(0);
  });

  it("still produces per-line findings when technical_specs is populated (regression: normal 4-sheet path)", () => {
    const w = workbook({
      line_items: [
        lineItem({ item: "L1", part_name: "Widget A" }),
        lineItem({ item: "L2", part_name: "Widget B" }),
      ],
      technical_specs: [{ part_name: "Widget A", spec_text: "A sufficiently long and detailed spec text." }],
    });
    const result = buildGapAnalysisFromWorkbook(w, [], []);
    const specFindings = result.missing_attachments.filter((m) => m.startsWith("Technical_Specs"));
    // Widget A has a usable spec (no finding); Widget B has none (one finding).
    expect(specFindings).toHaveLength(1);
    expect(specFindings[0]).toContain("L2");
    expect(specFindings[0]).toContain("Widget B");
  });

  it("does not pin risk_score to the cap for a large line-item count when technical_specs is empty", () => {
    const manyLineItems = Array.from({ length: 70 }, (_, i) =>
      lineItem({ item: `L${i + 1}`, part_name: `Widget ${i + 1}` }),
    );
    const w = workbook({ line_items: manyLineItems, technical_specs: [] });
    const result = buildGapAnalysisFromWorkbook(w, [], []);
    expect(result.risk_score).toBeLessThan(94);
  });
});
