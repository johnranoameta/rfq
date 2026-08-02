import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJson, fetchJsonNoStore, postFormJson } from "@/lib/http/fetchJson";

function stubFetch(res: { ok: boolean; status: number; body: unknown | "invalid-json" }) {
  const spy = vi.fn(async () => ({
    ok: res.ok,
    status: res.status,
    json: async () => {
      if (res.body === "invalid-json") throw new SyntaxError("Unexpected token <");
      return res.body;
    },
  }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJson", () => {
  it("returns the parsed body on success", async () => {
    stubFetch({ ok: true, status: 200, body: { rows: [1, 2] } });
    await expect(fetchJson<{ rows: number[] }>("/api/x", "Load failed")).resolves.toEqual({
      rows: [1, 2],
    });
  });

  it("throws the route-supplied error message", async () => {
    stubFetch({ ok: false, status: 400, body: { error: "partNumber is required" } });
    await expect(fetchJson("/api/x", "Lookup failed")).rejects.toThrow("partNumber is required");
  });

  it("throws '<fallback> (<status>)' when the route sends no message", async () => {
    stubFetch({ ok: false, status: 503, body: {} });
    await expect(fetchJson("/api/x", "Lookup failed")).rejects.toThrow("Lookup failed (503)");
  });

  it("treats an unparseable error body as empty and still reports the status", async () => {
    stubFetch({ ok: false, status: 500, body: "invalid-json" });
    await expect(fetchJson("/api/x", "Upload failed")).rejects.toThrow("Upload failed (500)");
  });

  it("passes init through to fetch", async () => {
    const spy = stubFetch({ ok: true, status: 200, body: {} });
    await fetchJson("/api/x", "Delete failed", { method: "DELETE" });
    expect(spy).toHaveBeenCalledWith("/api/x", { method: "DELETE" });
  });
});

describe("fetchJsonNoStore", () => {
  it("disables the HTTP cache", async () => {
    const spy = stubFetch({ ok: true, status: 200, body: { ok: 1 } });
    await fetchJsonNoStore("/api/x", "Load failed");
    expect(spy).toHaveBeenCalledWith("/api/x", { cache: "no-store" });
  });
});

describe("postFormJson", () => {
  it("POSTs the FormData body", async () => {
    const spy = stubFetch({ ok: true, status: 200, body: { imported: 3 } });
    const body = new FormData();
    await expect(postFormJson("/api/upload", body, "Upload failed")).resolves.toEqual({
      imported: 3,
    });
    expect(spy).toHaveBeenCalledWith("/api/upload", { method: "POST", body });
  });

  it("surfaces the route error for a rejected upload", async () => {
    stubFetch({ ok: false, status: 415, body: { error: "Unsupported file type" } });
    await expect(postFormJson("/api/upload", new FormData(), "Upload failed")).rejects.toThrow(
      "Unsupported file type",
    );
  });
});
