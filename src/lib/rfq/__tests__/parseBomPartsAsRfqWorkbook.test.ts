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

  it("returns false for a legitimate 4-sheet workbook using aliased/whitespace sheet names", () => {
    // `context` is a Header alias, `parts` is a Line_Items alias, and
    // `Technical_Specs` / `Supplier_Responses` use whitespace-containing display names.
    // The strict parser resolves all four via alias lists, so this must NOT be
    // misdetected as BOM-parts-shaped.
    const buf = workbookBuffer({
      context: [{ rfq_id: "RFQ-1" }],
      parts: [{ item: "L1" }],
      "Technical Specs": [{ part_name: "L1", spec_text: "text" }],
      "Supplier Responses": [{ supplier: "S1", item: "L1" }],
    });
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

  it("labels header.rfq_id with the multiplicity when parts span multiple distinct customer_program values", () => {
    const buf = workbookBuffer({
      parts: [
        { ref_designator: "R1", customer_program: "BM / Latch-ECU + Battery-Manager (Elatch)" },
        { ref_designator: "R2", customer_program: "BM / Latch-ECU + Battery-Manager (Elatch)" },
        { ref_designator: "R3", customer_program: "Magna / Ford Coil Driver Circuit" },
      ],
    });
    const { workbook } = parseBomPartsAsRfqWorkbook(buf);
    expect(workbook.header.rfq_id).toBe("BM / Latch-ECU + Battery-Manager (Elatch) (+1 more)");
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
