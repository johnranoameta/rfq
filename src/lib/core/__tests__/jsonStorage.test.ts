import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readJsonStorage,
  removeJsonStorage,
  writeJsonStorage,
} from "@/lib/core/jsonStorage";

/** Minimal localStorage stand-in; the vitest env is "node", so there is none. */
function installWindow(store = new Map<string, string>()) {
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal("window", { localStorage });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readJsonStorage", () => {
  beforeEach(() => installWindow());

  it("returns the fallback when the key is absent", () => {
    expect(readJsonStorage("missing", { a: 1 })).toEqual({ a: 1 });
  });

  it("round-trips a written value", () => {
    writeJsonStorage("k", { hello: "world" });
    expect(readJsonStorage("k", null)).toEqual({ hello: "world" });
  });

  it("returns the fallback on malformed JSON", () => {
    const store = installWindow();
    store.set("k", "{not json");
    expect(readJsonStorage("k", "fallback")).toBe("fallback");
  });

  it("returns the fallback when isValid rejects the parsed value", () => {
    writeJsonStorage("k", { shape: "wrong" });
    const rows = readJsonStorage<unknown[]>("k", [], (p) => Array.isArray(p));
    expect(rows).toEqual([]);
  });

  it("returns the parsed value when isValid accepts it", () => {
    writeJsonStorage("k", [1, 2, 3]);
    expect(readJsonStorage<number[]>("k", [], (p) => Array.isArray(p))).toEqual([1, 2, 3]);
  });

  it("treats an empty-string entry as absent", () => {
    const store = installWindow();
    store.set("k", "");
    expect(readJsonStorage("k", "fallback")).toBe("fallback");
  });
});

describe("writeJsonStorage", () => {
  it("swallows quota errors", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {},
      },
    });
    expect(() => writeJsonStorage("k", { big: "payload" })).not.toThrow();
  });
});

describe("removeJsonStorage", () => {
  it("deletes the key", () => {
    installWindow();
    writeJsonStorage("k", 1);
    removeJsonStorage("k");
    expect(readJsonStorage("k", "gone")).toBe("gone");
  });
});

describe("server-side rendering", () => {
  it("reads the fallback and never touches storage without a window", () => {
    // No window stubbed: this is the SSR path.
    expect(typeof window).toBe("undefined");
    expect(readJsonStorage("k", "ssr")).toBe("ssr");
    expect(() => writeJsonStorage("k", 1)).not.toThrow();
    expect(() => removeJsonStorage("k")).not.toThrow();
  });
});
