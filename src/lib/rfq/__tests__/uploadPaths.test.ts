import { describe, it, expect } from "vitest";
import { isSafeDrawingStoredName, isSafeWorkbookStoredName } from "@/lib/rfq/uploadPaths";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("isSafeWorkbookStoredName", () => {
  it("accepts a valid .xlsx stored name", () => {
    expect(isSafeWorkbookStoredName(`${UUID}.xlsx`)).toBe(true);
  });

  it("accepts a valid .xls stored name", () => {
    expect(isSafeWorkbookStoredName(`${UUID}.xls`)).toBe(true);
  });

  it("rejects a non-UUID stored name", () => {
    expect(isSafeWorkbookStoredName("not-a-uuid.xlsx")).toBe(false);
  });

  it("rejects an unrelated extension", () => {
    expect(isSafeWorkbookStoredName(`${UUID}.pdf`)).toBe(false);
  });
});

describe("isSafeDrawingStoredName", () => {
  it("accepts a valid .tif stored name", () => {
    expect(isSafeDrawingStoredName(`${UUID}.tif`)).toBe(true);
  });

  it("accepts a valid .tiff stored name", () => {
    expect(isSafeDrawingStoredName(`${UUID}.tiff`)).toBe(true);
  });

  it("rejects a non-UUID stored name", () => {
    expect(isSafeDrawingStoredName("not-a-uuid.tif")).toBe(false);
  });

  it("rejects an unrelated extension", () => {
    expect(isSafeDrawingStoredName(`${UUID}.xlsx`)).toBe(false);
  });
});
