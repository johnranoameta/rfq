import { describe, it, expect, beforeAll } from "vitest";
import { buildKbInquiryContext, compactSessionDigest, supplierPartsContextBlock } from "@/lib/rfq/kbInquiryContext";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";
import { replaceBomParts } from "@/lib/rfq/sqlite/bomPartsDb";
import { upsertSupplierPart } from "@/lib/rfq/sqlite/supplierPartsDb";
import type { RfqParseSessionFull } from "@/lib/rfq/sqlite/parseSessions";
import type { SupplierPartRow } from "@/lib/rfq/costLookupTypes";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function insertSession(sessionId: string, parsed: Record<string, unknown> = {}): void {
  const db = getRfqDb();
  db.prepare(
    `INSERT INTO rfq_parse_sessions (
       session_id, upload_id, original_filename, stored_filename,
       parse_json, historical_json, gap_json
     ) VALUES (?, ?, ?, ?, ?, '{"matches":[]}', '{}')`,
  ).run(sessionId, sessionId, "test.xlsx", `${sessionId}.xlsx`, JSON.stringify({ parsed }));
}

function fullSession(sessionId: string): RfqParseSessionFull {
  const db = getRfqDb();
  const row = db.prepare(`SELECT * FROM rfq_parse_sessions WHERE session_id = ?`).get(sessionId) as {
    parse_json: string;
  } & Record<string, unknown>;
  return {
    ...row,
    parse: JSON.parse(row.parse_json),
    historical: { matches: [] },
    gap: {},
  } as unknown as RfqParseSessionFull;
}

describe("compactSessionDigest", () => {
  it("attaches a resolved cost_lookup to a bom_part with a matching mfr_part_number", () => {
    insertSession("s-cost-1", { annual_volume: 1000 });
    replaceBomParts("s-cost-1", [
      {
        supplier_id: null,
        customer_program: null,
        sub_assembly: null,
        ref_designator: "R1",
        description: "Resistor",
        quantity: 2,
        unit_cost: null,
        currency: "USD",
        mfr_part_number: "ABC-123",
        extended_attributes_json: null,
        raw_source_ref: null,
      },
    ]);
    upsertSupplierPart({ part_number: "ABC-123", supplier_id: "ACME", source: "ACME quote", unit_cost: 0.5 });

    const digest = compactSessionDigest(fullSession("s-cost-1"), "RFQ1");
    const bomPart = (digest.bom_parts as Record<string, unknown>[])[0]!;
    expect(bomPart.cost_lookup).toBeDefined();
    const lookup = bomPart.cost_lookup as { internal: { unitCost: number } | null; selected: string | null };
    expect(lookup.internal?.unitCost).toBe(0.5);
    expect(lookup.selected).toBe("internal");
  });

  it("omits cost_lookup for a bom_part without a mfr_part_number", () => {
    insertSession("s-cost-2");
    replaceBomParts("s-cost-2", [
      {
        supplier_id: null,
        customer_program: null,
        sub_assembly: null,
        ref_designator: "R1",
        description: "Resistor",
        quantity: 1,
        unit_cost: null,
        currency: "USD",
        mfr_part_number: null,
        extended_attributes_json: null,
        raw_source_ref: null,
      },
    ]);

    const digest = compactSessionDigest(fullSession("s-cost-2"), "RFQ1");
    const bomPart = (digest.bom_parts as Record<string, unknown>[])[0]!;
    expect(bomPart.cost_lookup).toBeUndefined();
  });

  it("reports no cost data when no supplier_parts row matches", () => {
    insertSession("s-cost-3");
    replaceBomParts("s-cost-3", [
      {
        supplier_id: null,
        customer_program: null,
        sub_assembly: null,
        ref_designator: "R1",
        description: "Resistor",
        quantity: 1,
        unit_cost: null,
        currency: "USD",
        mfr_part_number: "NO-SUCH-PART",
        extended_attributes_json: null,
        raw_source_ref: null,
      },
    ]);

    const digest = compactSessionDigest(fullSession("s-cost-3"), "RFQ1");
    const bomPart = (digest.bom_parts as Record<string, unknown>[])[0]!;
    const lookup = bomPart.cost_lookup as { status: string; internal: unknown; external: unknown };
    expect(lookup.status).toBe("none");
    expect(lookup.internal).toBeNull();
    expect(lookup.external).toBeNull();
  });
});

describe("supplierPartsContextBlock", () => {
  it("returns null for an empty list", () => {
    expect(supplierPartsContextBlock([])).toBeNull();
  });

  it("formats rows into a labeled block", () => {
    const row: SupplierPartRow = {
      id: 1,
      part_number: "P-1",
      supplier_id: "ACME",
      source: "ACME quote",
      currency: "USD",
      unit_cost: 1.25,
      price_breaks_json: null,
      quote_date: null,
      fetched_at: null,
      lead_time: "4 weeks",
      approval_status: "approved",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    const block = supplierPartsContextBlock([row]);
    expect(block).toContain("Supplier & Part DB");
    expect(block).toContain("P-1");
    expect(block).toContain("4 weeks");
  });
});

describe("buildKbInquiryContext", () => {
  it("includes a Supplier & Part DB block listing rows", async () => {
    upsertSupplierPart({ part_number: "CTX-1", supplier_id: "ACME", source: "ACME quote", unit_cost: 1.25 });
    const context = await buildKbInquiryContext({});
    expect(context).toContain("Supplier & Part DB");
    expect(context).toContain("CTX-1");
  });
});
