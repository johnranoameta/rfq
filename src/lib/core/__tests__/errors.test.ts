import { describe, expect, it } from "vitest";

import { errorMessage } from "@/lib/core/errors";

describe("errorMessage", () => {
  it("prefers the Error message", () => {
    expect(errorMessage(new Error("Upload rejected"), "Upload failed")).toBe("Upload rejected");
  });

  it("falls back when the Error carries no message", () => {
    expect(errorMessage(new Error(""), "Upload failed")).toBe("Upload failed");
  });

  it("accepts a bare string throw", () => {
    expect(errorMessage("boom", "Upload failed")).toBe("boom");
  });

  it("ignores a whitespace-only string throw", () => {
    expect(errorMessage("   ", "Upload failed")).toBe("Upload failed");
  });

  it("falls back for non-Error values", () => {
    expect(errorMessage(null, "Load failed")).toBe("Load failed");
    expect(errorMessage(undefined, "Load failed")).toBe("Load failed");
    expect(errorMessage({ message: "nope" }, "Load failed")).toBe("Load failed");
  });

  it("keeps subclass messages", () => {
    class HttpError extends Error {}
    expect(errorMessage(new HttpError("404"), "Load failed")).toBe("404");
  });
});
