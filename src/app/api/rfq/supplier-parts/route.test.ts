import { describe, it, expect, beforeAll } from "vitest";
import { GET, POST } from "./route";

beforeAll(() => {
  process.env.RFQ_DATABASE_PATH = ":memory:";
});

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/rfq/supplier-parts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/rfq/supplier-parts", () => {
  it("creates a row with only the required fields and returns it", async () => {
    const res = await POST(
      postRequest({ part_number: "ABC-1", supplier_id: "AAG", source: "AAG quote" }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.row.part_number).toBe("ABC-1");
    expect(json.row.supplier_id).toBe("AAG");
    expect(json.row.source).toBe("AAG quote");
    expect(json.row.currency).toBe("USD");
    expect(json.row.unit_cost).toBeNull();
  });

  it("creates a row with optional fields set", async () => {
    const res = await POST(
      postRequest({
        part_number: "ABC-2",
        supplier_id: "AAG",
        source: "AAG quote",
        currency: "EUR",
        unit_cost: "3.25",
        lead_time: "4 weeks",
        approval_status: "approved",
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.row.currency).toBe("EUR");
    expect(json.row.unit_cost).toBe(3.25);
    expect(json.row.lead_time).toBe("4 weeks");
    expect(json.row.approval_status).toBe("approved");
  });

  it("rejects a missing part_number with 400", async () => {
    const res = await POST(postRequest({ supplier_id: "AAG", source: "AAG quote" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty supplier_id with 400", async () => {
    const res = await POST(postRequest({ part_number: "ABC-3", supplier_id: "", source: "AAG quote" }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric unit_cost with 400", async () => {
    const res = await POST(
      postRequest({ part_number: "ABC-4", supplier_id: "AAG", source: "AAG quote", unit_cost: "not-a-number" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/rfq/supplier-parts", { method: "POST", body: "not json" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 for a duplicate supplier_id + part_number", async () => {
    await POST(postRequest({ part_number: "DUPE-1", supplier_id: "AAG", source: "AAG quote" }));
    const res = await POST(postRequest({ part_number: "DUPE-1", supplier_id: "AAG", source: "AAG quote" }));
    expect(res.status).toBe(409);
  });

  it("GET still lists rows including newly created ones", async () => {
    await POST(postRequest({ part_number: "LIST-CHECK", supplier_id: "AAG", source: "AAG quote" }));
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.rows.some((r: { part_number: string }) => r.part_number === "LIST-CHECK")).toBe(true);
  });
});
