import { describe, it, expect, beforeAll } from "vitest";
import { PATCH } from "./route";
import { upsertSupplierPart } from "@/lib/rfq/sqlite/supplierPartsDb";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function insertRow(partNumber: string, supplierId: string): number {
  upsertSupplierPart({ part_number: partNumber, supplier_id: supplierId, source: supplierId, unit_cost: 1.5 });
  const db = getRfqDb();
  const row = db
    .prepare(`SELECT id FROM supplier_parts WHERE part_number = ? AND supplier_id = ?`)
    .get(partNumber, supplierId) as { id: number };
  return row.id;
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/rfq/supplier-parts/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/rfq/supplier-parts/[id]", () => {
  it("updates a whitelisted field and returns the updated row", async () => {
    const id = insertRow("ABC-1", "AAG");
    const res = await PATCH(patchRequest({ field: "lead_time", value: "4 weeks" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.row.lead_time).toBe("4 weeks");
  });

  it("rejects a field outside the whitelist with 400", async () => {
    const id = insertRow("ABC-2", "AAG");
    const res = await PATCH(patchRequest({ field: "id", value: 999 }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric value for unit_cost with 400", async () => {
    const id = insertRow("ABC-3", "AAG");
    const res = await PATCH(patchRequest({ field: "unit_cost", value: "not-a-number" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an empty part_number with 400", async () => {
    const id = insertRow("ABC-4", "AAG");
    const res = await PATCH(patchRequest({ field: "part_number", value: "" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 when editing into a duplicate supplier_id + part_number", async () => {
    insertRow("DUPE-1", "AAG");
    const id2 = insertRow("DUPE-2", "AAG");
    const res = await PATCH(patchRequest({ field: "part_number", value: "DUPE-1" }), {
      params: Promise.resolve({ id: String(id2) }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 404 when the row does not exist", async () => {
    const res = await PATCH(patchRequest({ field: "lead_time", value: "x" }), {
      params: Promise.resolve({ id: "999999" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const res = await PATCH(patchRequest({ field: "lead_time", value: "x" }), {
      params: Promise.resolve({ id: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });
});
