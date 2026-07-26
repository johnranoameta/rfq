import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseBomPartsWorkbook } from "@/lib/rfq/parseBomPartsWorkbook";

function workbookBuffer(rows: Record<string, unknown>[], sheetName = "parts"): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseBomPartsWorkbook", () => {
  it("parses rows with the expected columns from a 'parts' sheet", () => {
    const buf = workbookBuffer([
      {
        supplier_id: "aag",
        customer_program: "BM / Latch-ECU + Battery-Manager (Elatch)",
        sub_assembly: "LATCH ECU",
        ref_designator: "PCB",
        description: "FR4, TG170, 2 Layer",
        quantity: 1,
        unit_cost: 1.026,
        currency: "USD",
        extended_attributes_json: JSON.stringify({ mfr_part_number: "DRW S05137-38" }),
        raw_source_ref: "AAGQuote200811018_BM_Elatch.xls!Bom!row7",
      },
    ]);
    const { rows, skipped } = parseBomPartsWorkbook(buf);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      supplier_id: "AAG",
      customer_program: "BM / Latch-ECU + Battery-Manager (Elatch)",
      sub_assembly: "LATCH ECU",
      ref_designator: "PCB",
      quantity: 1,
      unit_cost: 1.026,
      currency: "USD",
      mfr_part_number: "DRW S05137-38",
    });
  });

  it("prefers a sheet literally named 'parts' over the first sheet", () => {
    const wsReadme = XLSX.utils.json_to_sheet([{ Field: "Purpose", Explanation: "..." }]);
    const wsParts = XLSX.utils.json_to_sheet([{ ref_designator: "Label", quantity: 1 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsReadme, "README");
    XLSX.utils.book_append_sheet(wb, wsParts, "parts");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const { rows } = parseBomPartsWorkbook(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].ref_designator).toBe("Label");
  });

  it("extracts mfr_part_number out of extended_attributes_json", () => {
    const buf = workbookBuffer([
      {
        ref_designator: "Male Connector PIN - J1",
        extended_attributes_json: JSON.stringify({
          mfr_part_number: "DRW S05267 EFS 08-0077-P",
          value: "18 PIN",
        }),
      },
    ]);
    const { rows } = parseBomPartsWorkbook(buf);
    expect(rows[0].mfr_part_number).toBe("DRW S05267 EFS 08-0077-P");
    expect(JSON.parse(rows[0].extended_attributes_json!)).toMatchObject({ value: "18 PIN" });
  });

  it("drops malformed extended_attributes_json without failing the row", () => {
    const buf = workbookBuffer([{ ref_designator: "Packing", unit_cost: 0.015, extended_attributes_json: "not json" }]);
    const { rows, skipped } = parseBomPartsWorkbook(buf);
    expect(skipped).toBe(0);
    expect(rows[0].extended_attributes_json).toBeNull();
    expect(rows[0].mfr_part_number).toBeNull();
    expect(rows[0].unit_cost).toBe(0.015);
  });

  it("skips rows missing ref_designator", () => {
    const buf = workbookBuffer([
      { ref_designator: "", description: "no designator" },
      { ref_designator: "Paste", description: "has designator" },
    ]);
    const { rows, skipped } = parseBomPartsWorkbook(buf);
    expect(skipped).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].ref_designator).toBe("Paste");
  });

  it("has no mfr_part_number when extended_attributes_json is absent", () => {
    const buf = workbookBuffer([{ ref_designator: "Label", unit_cost: 0.005 }]);
    const { rows } = parseBomPartsWorkbook(buf);
    expect(rows[0].mfr_part_number).toBeNull();
    expect(rows[0].extended_attributes_json).toBeNull();
  });
});
