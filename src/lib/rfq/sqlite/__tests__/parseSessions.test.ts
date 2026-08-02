import { describe, it, expect, beforeAll } from "vitest";
import { deleteRfqParseSession } from "@/lib/rfq/sqlite/parseSessions";
import { listBomParts, replaceBomParts } from "@/lib/rfq/sqlite/bomPartsDb";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function insertSession(sessionId: string): void {
  const db = getRfqDb();
  db.prepare(
    `INSERT INTO rfq_parse_sessions (
       session_id, upload_id, original_filename, stored_filename,
       parse_json, historical_json, gap_json
     ) VALUES (?, ?, ?, ?, '{}', '{}', '{}')`,
  ).run(sessionId, sessionId, "test.xlsx", `${sessionId}.xlsx`);
}

describe("deleteRfqParseSession", () => {
  it("deletes the session row and returns true", () => {
    insertSession("session-del-1");
    const removed = deleteRfqParseSession("session-del-1");
    expect(removed).toBe(true);
  });

  it("returns false when the session doesn't exist", () => {
    expect(deleteRfqParseSession("no-such-session")).toBe(false);
  });

  it("also removes bom_parts rows synced under the same id", () => {
    insertSession("session-del-2");
    replaceBomParts("session-del-2", [
      {
        supplier_id: null,
        customer_program: null,
        sub_assembly: null,
        ref_designator: "R1",
        description: "Resistor",
        quantity: 1,
        unit_cost: 0.05,
        currency: "USD",
        mfr_part_number: null,
        extended_attributes_json: null,
        raw_source_ref: null,
      },
    ]);
    expect(listBomParts("session-del-2")).toHaveLength(1);

    deleteRfqParseSession("session-del-2");

    expect(listBomParts("session-del-2")).toEqual([]);
  });

  it("does not touch bom_parts for a different rfqFileId", () => {
    insertSession("session-del-3");
    replaceBomParts("session-del-3", [
      {
        supplier_id: null,
        customer_program: null,
        sub_assembly: null,
        ref_designator: "R1",
        description: "Resistor",
        quantity: 1,
        unit_cost: 0.05,
        currency: "USD",
        mfr_part_number: null,
        extended_attributes_json: null,
        raw_source_ref: null,
      },
    ]);

    deleteRfqParseSession("no-such-session");

    expect(listBomParts("session-del-3")).toHaveLength(1);
  });
});
