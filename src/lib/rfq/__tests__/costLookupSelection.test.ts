import { describe, it, expect } from "vitest";
import { compareCostSources, DISAGREEMENT_RISK_THRESHOLD_PCT } from "@/lib/rfq/costLookupSelection";
import type { ResolvedUnitCost } from "@/lib/rfq/costLookupTypes";

function cost(unitCost: number, tierMinQty = 1000): ResolvedUnitCost {
  return { unitCost, currency: "USD", tierMinQty, belowMinTier: false };
}

describe("compareCostSources", () => {
  it("selects the external source for the issue's worked example (0.0720 internal vs 0.0685 external @ 1,500)", () => {
    const result = compareCostSources({
      quantity: 1500,
      internal: cost(0.072),
      external: cost(0.0685),
      externalSourceLabel: "Trustedparts.com",
      externalStale: false,
    });
    expect(result.status).toBe("compared");
    expect(result.selected).toBe("external");
    expect(result.explanation).toContain("0.0720");
    expect(result.explanation).toContain("0.0685");
    expect(result.explanation).toContain("1500");
    expect(result.explanation).toContain("Trustedparts.com");
  });

  it("flags disagreement above the threshold as a risk rather than silently picking the lower number", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: cost(1.0),
      external: cost(0.5), // 50% difference
      externalSourceLabel: "Trustedparts.com",
      externalStale: false,
    });
    expect(result.riskFlag).toBe(true);
    expect(result.disagreementPct).toBeGreaterThan(DISAGREEMENT_RISK_THRESHOLD_PCT);
    expect(result.explanation).toMatch(/disagree/i);
  });

  it("does not flag disagreement within the threshold", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: cost(1.0),
      external: cost(0.95), // 5% difference
      externalSourceLabel: "Trustedparts.com",
      externalStale: false,
    });
    expect(result.riskFlag).toBe(false);
  });

  it("reports internal-only without implying a comparison happened", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: cost(0.5),
      external: null,
      externalSourceLabel: null,
      externalStale: false,
    });
    expect(result.status).toBe("internal_only");
    expect(result.selected).toBe("internal");
    expect(result.riskFlag).toBe(false);
    expect(result.disagreementPct).toBeNull();
    expect(result.explanation).not.toMatch(/beats|vs\.?/i);
  });

  it("reports external-only without implying a comparison happened", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: null,
      external: cost(0.5),
      externalSourceLabel: "Trustedparts.com",
      externalStale: true,
    });
    expect(result.status).toBe("external_only");
    expect(result.selected).toBe("external");
    expect(result.explanation).toMatch(/stale/i);
  });

  it("uses the required failure phrase when the external fetch failed and no data exists", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: null,
      external: null,
      externalSourceLabel: null,
      externalStale: false,
      externalFailed: true,
    });
    expect(result.status).toBe("none");
    expect(result.explanation).toContain("lookup failed — using internal cost only");
  });

  it("reports no data plainly when neither source has data", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: null,
      external: null,
      externalSourceLabel: null,
      externalStale: false,
    });
    expect(result.status).toBe("none");
    expect(result.selected).toBeNull();
  });
});
