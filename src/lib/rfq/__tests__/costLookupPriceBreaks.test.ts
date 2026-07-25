import { describe, it, expect } from "vitest";
import { parsePriceBreaksJson, resolveUnitCostAtQuantity } from "@/lib/rfq/costLookupPriceBreaks";

describe("resolveUnitCostAtQuantity", () => {
  it("resolves an exact tier match", () => {
    const tiers = [
      { min_qty: 1, unit_cost: 0.1 },
      { min_qty: 1000, unit_cost: 0.072 },
    ];
    const r = resolveUnitCostAtQuantity(tiers, null, "USD", 1000);
    expect(r).toEqual({ unitCost: 0.072, currency: "USD", tierMinQty: 1000, belowMinTier: false });
  });

  it("resolves the next tier down (issue's 1,500-pc worked example)", () => {
    const tiers = [{ min_qty: 1000, unit_cost: 0.0685 }];
    const r = resolveUnitCostAtQuantity(tiers, null, "USD", 1500);
    expect(r).toEqual({ unitCost: 0.0685, currency: "USD", tierMinQty: 1000, belowMinTier: false });
  });

  it("flags belowMinTier and uses the lowest tier when quantity is below every tier", () => {
    const tiers = [{ min_qty: 1000, unit_cost: 0.0685 }];
    const r = resolveUnitCostAtQuantity(tiers, null, "USD", 500);
    expect(r).toEqual({ unitCost: 0.0685, currency: "USD", tierMinQty: 1000, belowMinTier: true });
  });

  it("falls back to the flat unit cost as an implicit tier at qty 1 when no price breaks exist", () => {
    const r = resolveUnitCostAtQuantity(null, 0.072, "USD", 1500);
    expect(r).toEqual({ unitCost: 0.072, currency: "USD", tierMinQty: 1, belowMinTier: false });
  });

  it("returns null when there is no price-break data and no flat cost", () => {
    const r = resolveUnitCostAtQuantity(null, null, "USD", 1500);
    expect(r).toBeNull();
  });

  it("picks the highest applicable tier below or equal to the requested quantity", () => {
    const tiers = [
      { min_qty: 1, unit_cost: 0.2 },
      { min_qty: 100, unit_cost: 0.15 },
      { min_qty: 1000, unit_cost: 0.1 },
    ];
    const r = resolveUnitCostAtQuantity(tiers, null, "USD", 500);
    expect(r).toEqual({ unitCost: 0.15, currency: "USD", tierMinQty: 100, belowMinTier: false });
  });
});

describe("parsePriceBreaksJson", () => {
  it("parses and sorts a valid tier array", () => {
    const json = JSON.stringify([
      { min_qty: 1000, unit_cost: 0.1 },
      { min_qty: 1, unit_cost: 0.2 },
    ]);
    expect(parsePriceBreaksJson(json)).toEqual([
      { min_qty: 1, unit_cost: 0.2 },
      { min_qty: 1000, unit_cost: 0.1 },
    ]);
  });

  it("returns null for missing, malformed, or non-array JSON", () => {
    expect(parsePriceBreaksJson(null)).toBeNull();
    expect(parsePriceBreaksJson(undefined)).toBeNull();
    expect(parsePriceBreaksJson("not json")).toBeNull();
    expect(parsePriceBreaksJson(JSON.stringify({ min_qty: 1 }))).toBeNull();
  });
});
