import { describe, it, expect } from "vitest";
import { compareCostSources, DISAGREEMENT_RISK_THRESHOLD_PCT } from "@/lib/rfq/costLookupSelection";
import type { ResolvedUnitCost } from "@/lib/rfq/costLookupTypes";

function cost(unitCost: number, tierMinQty = 1000): ResolvedUnitCost {
  return { unitCost, currency: "USD", tierMinQty, belowMinTier: false };
}

describe("compareCostSources", () => {
  it("selects Trustedparts for the issue's worked example (0.0720 internal vs 0.0685 Trustedparts @ 1,500)", () => {
    const result = compareCostSources({
      quantity: 1500,
      internal: cost(0.072),
      trustedparts: cost(0.0685),
      trustedpartsStale: false,
    });
    expect(result.status).toBe("compared");
    expect(result.selected).toBe("trustedparts");
    expect(result.explanation).toContain("0.0720");
    expect(result.explanation).toContain("0.0685");
    expect(result.explanation).toContain("1500");
  });

  it("flags disagreement above the threshold as a risk rather than silently picking the lower number", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: cost(1.0),
      trustedparts: cost(0.5), // 50% difference
      trustedpartsStale: false,
    });
    expect(result.riskFlag).toBe(true);
    expect(result.disagreementPct).toBeGreaterThan(DISAGREEMENT_RISK_THRESHOLD_PCT);
    expect(result.explanation).toMatch(/disagree/i);
  });

  it("does not flag disagreement within the threshold", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: cost(1.0),
      trustedparts: cost(0.95), // 5% difference
      trustedpartsStale: false,
    });
    expect(result.riskFlag).toBe(false);
  });

  it("reports internal-only without implying a comparison happened", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: cost(0.5),
      trustedparts: null,
      trustedpartsStale: false,
    });
    expect(result.status).toBe("internal_only");
    expect(result.selected).toBe("internal");
    expect(result.riskFlag).toBe(false);
    expect(result.disagreementPct).toBeNull();
    expect(result.explanation).not.toMatch(/beats|vs\.?/i);
  });

  it("reports trustedparts-only without implying a comparison happened", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: null,
      trustedparts: cost(0.5),
      trustedpartsStale: true,
    });
    expect(result.status).toBe("trustedparts_only");
    expect(result.selected).toBe("trustedparts");
    expect(result.explanation).toMatch(/stale/i);
  });

  it("uses the required failure phrase when Trustedparts fetch failed and no data exists", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: null,
      trustedparts: null,
      trustedpartsStale: false,
      trustedpartsFailed: true,
    });
    expect(result.status).toBe("none");
    expect(result.explanation).toContain("Trustedparts lookup failed — using internal cost only");
  });

  it("reports no data plainly when neither source has data", () => {
    const result = compareCostSources({
      quantity: 1000,
      internal: null,
      trustedparts: null,
      trustedpartsStale: false,
    });
    expect(result.status).toBe("none");
    expect(result.selected).toBeNull();
  });
});
