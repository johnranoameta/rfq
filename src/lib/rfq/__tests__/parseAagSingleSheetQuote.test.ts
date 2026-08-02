import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  looksLikeAagSingleSheetQuote,
  parseAagSingleSheetQuote,
} from "@/lib/rfq/parseAagSingleSheetQuote";
import { looksLikeBomPartsRfqUpload } from "@/lib/rfq/parseBomPartsAsRfqWorkbook";

function sheetBuffer(rows: unknown[][], sheetName = "Sheet1"): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xls" }) as Buffer;
}

function minimalAagRows(): unknown[][] {
  const rows: unknown[][] = [];
  rows[0] = ["REQUEST FOR QUOTE", "", "", "", "", "Due Date:", "9/8/14"];
  rows[2] = ["Customer:", "", "Acme Corp"];
  rows[3] = ["Program Name:", "", "Widget Line"];
  rows[4] = ["", "Program Life: ", "Unknown", "", "Estimated SOP Date: 2027-01-01"];
  rows[6] = ["", "EAU:", "1,500,000 "];
  rows[10] = [
    "Item #",
    "Qty per Assy",
    "Unit",
    "Ref Designation",
    "Manufacturer or\nSuggested Supplier",
    "Part Number",
    "Description",
    "Target Price",
    "Unit price",
    " Sub-Total ",
    "Comments",
  ];
  rows[11] = [1, 2, "each", "", "Diodes", "S1GT-04LC-F", "Rectifier", "", 0.04, 0.08, "note"];
  rows[12] = [2, 1, "each", "", "Vishay", "CRCW06032K20JNEA", "Chip resistor", 0.05, 0.0031, 0.0031, ""];
  rows[13] = [3, "", "", "", "", "", "", "", "", "", ""];
  rows[43] = ["", "", "", "", "", "", "", "", "BOM cost", 1.0643];
  rows[44] = ["", "", "", "", "", "", "", "", "loss rate", 0.0034];
  rows[45] = ["", "", "", "", "", "", "", "", "Labor", 0.1054];
  rows[46] = ["", "", "", "", "", "", "", "", "Overhead & Burden", 0.1204];
  rows[60] = ["", "", "", "", "", "", "", "", "SG&A", 0.0996];
  rows[61] = ["", "", "", "", "", "", "", "", "Profit ", 0.0594];
  rows[62] = ["", "", "", "", "", "", "", "", "Packaging cost", 0.04];
  rows[64] = ["", "", "", "", "", "", "", "", "FOB Shanghai", 1.4925];
  rows[66] = ["", "", "", "", "", "", "", "", " FOB Huntsville ", 1.4925];
  rows[81] = ["TOOLING COST"];
  rows[82] = ["Item #", "QTY", "Unit", " Sub-Total ", "Description", "", "Tooling Completion"];
  rows[83] = [1, 1, "each", 400, "PCB Tooling"];
  rows[84] = [2, 1, "each", 350, "Stencil Tooling"];
  rows[96] = ["", "", "", 750];
  return rows;
}

describe("looksLikeAagSingleSheetQuote", () => {
  it("returns true for a sheet with a BOM table header and a cost-breakdown block", () => {
    const buf = sheetBuffer(minimalAagRows());
    expect(looksLikeAagSingleSheetQuote(buf)).toBe(true);
  });

  it("returns false when there is no BOM table header", () => {
    const rows = minimalAagRows();
    rows[10] = ["Not", "A", "Header"];
    const buf = sheetBuffer(rows);
    expect(looksLikeAagSingleSheetQuote(buf)).toBe(false);
  });

  it("returns false when there is no cost-breakdown block", () => {
    const rows = minimalAagRows();
    rows[43] = [];
    const buf = sheetBuffer(rows);
    expect(looksLikeAagSingleSheetQuote(buf)).toBe(false);
  });

  it("does not collide with the BOM Intelligence (parts sheet) detector", () => {
    const buf = sheetBuffer(minimalAagRows());
    expect(looksLikeBomPartsRfqUpload(buf)).toBe(false);
  });
});

describe("parseAagSingleSheetQuote", () => {
  it("extracts header fields, repurposing region for the program name", () => {
    const buf = sheetBuffer(minimalAagRows());
    const { workbook } = parseAagSingleSheetQuote(buf);
    expect(workbook.header.customer).toBe("Acme Corp");
    expect(workbook.header.region).toBe("Widget Line");
    expect(workbook.header.sop).toBe("2027-01-01");
    expect(workbook.header.annual_volume).toBe(1500000);
    expect(workbook.header.rfq_id).toBe("");
  });

  it("extracts BOM line items and stops at the first fully-blank row", () => {
    const buf = sheetBuffer(minimalAagRows());
    const { workbook } = parseAagSingleSheetQuote(buf);
    expect(workbook.line_items).toHaveLength(2);
    expect(workbook.line_items[0]).toMatchObject({
      item: "1",
      part_name: "Rectifier",
      system: "Diodes",
      subsystem: "S1GT-04LC-F",
    });
  });

  it("prefers an explicit Target Price over Unit price when both are present", () => {
    const buf = sheetBuffer(minimalAagRows());
    const { workbook } = parseAagSingleSheetQuote(buf);
    expect(workbook.line_items[1]?.target_price).toBe(0.05);
  });

  it("falls back to Unit price when Target Price is blank", () => {
    const buf = sheetBuffer(minimalAagRows());
    const { workbook } = parseAagSingleSheetQuote(buf);
    expect(workbook.line_items[0]?.target_price).toBe(0.04);
  });

  it("returns empty technical_specs and supplier_responses", () => {
    const buf = sheetBuffer(minimalAagRows());
    const { workbook } = parseAagSingleSheetQuote(buf);
    expect(workbook.technical_specs).toEqual([]);
    expect(workbook.supplier_responses).toEqual([]);
  });

  it("extracts all cost-breakdown fields", () => {
    const buf = sheetBuffer(minimalAagRows());
    const { costElements } = parseAagSingleSheetQuote(buf);
    expect(costElements).toMatchObject({
      bom_cost: 1.0643,
      loss_rate: 0.0034,
      labor: 0.1054,
      overhead_burden: 0.1204,
      sga: 0.0996,
      profit: 0.0594,
      packaging_cost: 0.04,
      fob_shanghai: 1.4925,
      fob_huntsville: 1.4925,
    });
  });

  it("extracts tooling line items and the tooling grand total", () => {
    const buf = sheetBuffer(minimalAagRows());
    const { costElements } = parseAagSingleSheetQuote(buf);
    expect(costElements.tooling_items).toEqual([
      { description: "PCB Tooling", sub_total: 400 },
      { description: "Stencil Tooling", sub_total: 350 },
    ]);
    expect(costElements.tooling_total).toBe(750);
  });

  it("builds bom_parts rows with ref_designator falling back to part number", () => {
    const buf = sheetBuffer(minimalAagRows());
    const { bomPartsRows } = parseAagSingleSheetQuote(buf);
    expect(bomPartsRows).toHaveLength(2);
    expect(bomPartsRows[0]).toMatchObject({
      ref_designator: "S1GT-04LC-F",
      description: "Rectifier",
      quantity: 2,
      unit_cost: 0.04,
      mfr_part_number: "S1GT-04LC-F",
      customer_program: "Widget Line",
    });
  });

  it("returns null for cost fields not present in the sheet", () => {
    const rows = minimalAagRows();
    rows[64] = [];
    const buf = sheetBuffer(rows);
    const { costElements } = parseAagSingleSheetQuote(buf);
    expect(costElements.fob_shanghai).toBeNull();
  });
});
