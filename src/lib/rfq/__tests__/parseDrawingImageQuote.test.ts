import { describe, it, expect } from "vitest";
import { mapDrawingExtractionToWorkbook, type DrawingExtractionResult } from "@/lib/rfq/parseDrawingImageQuote";

function sampleExtraction(): DrawingExtractionResult {
  return {
    header: {
      part_number: "F3040-X1092-B",
      part_name: "CIRCUIT ASSY. ILLUMINATION",
      customer: "Toyota Boshoku Corporation",
    },
    bom: [
      {
        part_name: "PCB",
        reference: null,
        tb_part_number: "F3W21-X102F",
        supplier_part_number: null,
        supplier: null,
        quantity: 1,
        note: null,
      },
      {
        part_name: "LED",
        reference: "LED1",
        tb_part_number: "F3X1J-X1012",
        supplier_part_number: "NSSW064A#",
        supplier: "NICHIA",
        quantity: 1,
        note: "Luminous color: white",
      },
      {
        part_name: "Resistor",
        reference: "R1,R2",
        tb_part_number: "F3X31-X1012",
        supplier_part_number: "ESR18###J471",
        supplier: "ROHM",
        quantity: 2,
        note: "470Ω 0.5W ±5%",
      },
    ],
    specs: [
      { label: "Rated Voltage", value: "DC 12V" },
      { label: "Max Current", value: "14mA" },
    ],
  };
}

describe("mapDrawingExtractionToWorkbook", () => {
  it("maps header fields, repurposing region for part name and rfq_id for the drawing number", () => {
    const { workbook } = mapDrawingExtractionToWorkbook(sampleExtraction());
    expect(workbook.header.rfq_id).toBe("F3040-X1092-B");
    expect(workbook.header.region).toBe("CIRCUIT ASSY. ILLUMINATION");
    expect(workbook.header.customer).toBe("Toyota Boshoku Corporation");
    expect(workbook.header.sop).toBe("");
  });

  it("maps BOM rows into line items with no pricing data", () => {
    const { workbook } = mapDrawingExtractionToWorkbook(sampleExtraction());
    expect(workbook.line_items).toHaveLength(3);
    expect(workbook.line_items[1]).toMatchObject({
      item: "LED1",
      part_name: "LED",
      system: "NICHIA",
      subsystem: "F3X1J-X1012",
      target_price: null,
    });
  });

  it("falls back to tb_part_number then part_name when reference is missing", () => {
    const { workbook } = mapDrawingExtractionToWorkbook(sampleExtraction());
    expect(workbook.line_items[0]?.item).toBe("F3W21-X102F");
  });

  it("returns empty technical_specs and supplier_responses", () => {
    const { workbook } = mapDrawingExtractionToWorkbook(sampleExtraction());
    expect(workbook.technical_specs).toEqual([]);
    expect(workbook.supplier_responses).toEqual([]);
  });

  it("puts spec pairs into a single extraInfo sheet", () => {
    const { extraInfo } = mapDrawingExtractionToWorkbook(sampleExtraction());
    expect(extraInfo).toEqual([
      {
        sheet: "Specifications",
        rows: [
          { Label: "Rated Voltage", Value: "DC 12V" },
          { Label: "Max Current", Value: "14mA" },
        ],
      },
    ]);
  });

  it("returns an empty extraInfo array when there are no specs", () => {
    const extraction = { ...sampleExtraction(), specs: [] };
    const { extraInfo } = mapDrawingExtractionToWorkbook(extraction);
    expect(extraInfo).toEqual([]);
  });

  it("builds bom_parts rows with ref_designator falling back through tb_part_number", () => {
    const { bomPartsRows } = mapDrawingExtractionToWorkbook(sampleExtraction());
    expect(bomPartsRows).toHaveLength(3);
    expect(bomPartsRows[0]).toMatchObject({
      ref_designator: "F3W21-X102F",
      description: "PCB",
      quantity: 1,
      unit_cost: null,
      mfr_part_number: "F3W21-X102F",
    });
    expect(bomPartsRows[1]).toMatchObject({
      ref_designator: "LED1",
      mfr_part_number: "F3X1J-X1012",
    });
  });

  it("skips bom rows with no part_name", () => {
    const extraction = sampleExtraction();
    extraction.bom.push({
      part_name: "",
      reference: null,
      tb_part_number: null,
      supplier_part_number: null,
      supplier: null,
      quantity: null,
      note: null,
    });
    const { workbook, bomPartsRows } = mapDrawingExtractionToWorkbook(extraction);
    expect(workbook.line_items).toHaveLength(3);
    expect(bomPartsRows).toHaveLength(3);
  });
});
