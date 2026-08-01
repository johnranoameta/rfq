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

  it("does not overwrite existing bom_parts rows on a second sync for the same rfqFileId", () => {
    const first = workbookBuffer({ parts: [{ ref_designator: "R1" }] });
    const second = workbookBuffer({ parts: [{ ref_designator: "R2" }] });
    maybeSyncBomPartsFromRfqUpload(first, "rfq-sync-3");
    maybeSyncBomPartsFromRfqUpload(second, "rfq-sync-3");
    const rows = listBomParts("rfq-sync-3");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ref_designator).toBe("R1");
  });
});
