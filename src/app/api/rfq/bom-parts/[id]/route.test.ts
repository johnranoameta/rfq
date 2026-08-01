import { describe, it, expect, beforeAll } from "vitest";
import { PATCH } from "./route";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function insertRow(): number {
  const db = getRfqDb();
  const info = db
    .prepare(
      `INSERT INTO bom_parts (rfq_file_id, ref_designator, description, quantity, unit_cost, currency)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run("file-1", "R1", "resistor", 2, 1.5, "USD");
  return Number(info.lastInsertRowid);
}

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/rfq/bom-parts/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/rfq/bom-parts/[id]", () => {
  it("updates a whitelisted field and returns the updated row", async () => {
    const id = insertRow();
    const res = await PATCH(patchRequest({ field: "description", value: "new description" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.row.description).toBe("new description");
  });

  it("rejects a field outside the whitelist with 400", async () => {
    const id = insertRow();
    const res = await PATCH(patchRequest({ field: "rfq_file_id", value: "hacked" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric value for a numeric field with 400", async () => {
    const id = insertRow();
    const res = await PATCH(patchRequest({ field: "unit_cost", value: "not-a-number" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an empty ref_designator with 400", async () => {
    const id = insertRow();
    const res = await PATCH(patchRequest({ field: "ref_designator", value: "" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the row does not exist", async () => {
    const res = await PATCH(patchRequest({ field: "description", value: "x" }), {
      params: Promise.resolve({ id: "999999" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const res = await PATCH(patchRequest({ field: "description", value: "x" }), {
      params: Promise.resolve({ id: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });
});
