import { describe, expect, it } from "vitest";

import type { GapFinding, GapWorkflowStatus } from "@/data/rfqTypes";
import {
  computeCostExposure,
  parseImpactDollars,
  riskTone,
} from "@/lib/rfq/gapCostExposure";

function finding(rule: string, impact: string): GapFinding {
  return { rule, impact } as GapFinding;
}

describe("parseImpactDollars", () => {
  it("reads a per-piece range with an en-dash", () => {
    expect(parseImpactDollars("Adds $0.12–0.18/pc")).toEqual({ perPc: [0.12, 0.18] });
  });

  it("reads a per-piece range with a hyphen", () => {
    expect(parseImpactDollars("Adds $0.12-0.18/pc")).toEqual({ perPc: [0.12, 0.18] });
  });

  it("treats a single per-piece figure as a zero-width range", () => {
    expect(parseImpactDollars("about $0.40/pc")).toEqual({ perPc: [0.4, 0.4] });
  });

  it("scales a K-suffixed NRE range to dollars", () => {
    expect(parseImpactDollars("Tooling $12K–18K")).toEqual({ nre: [12000, 18000] });
  });

  it("scales a single K-suffixed NRE figure", () => {
    expect(parseImpactDollars("Tooling $7.5K")).toEqual({ nre: [7500, 7500] });
  });

  it("is case-insensitive on the K suffix", () => {
    expect(parseImpactDollars("Tooling $3k")).toEqual({ nre: [3000, 3000] });
  });

  it("prefers a per-piece figure when both forms appear", () => {
    expect(parseImpactDollars("$0.05/pc plus $10K tooling")).toEqual({ perPc: [0.05, 0.05] });
  });

  it("returns nothing for text with no dollar figure", () => {
    expect(parseImpactDollars("Schedule risk only")).toEqual({});
  });

  it("returns nothing for a bare dollar amount it cannot classify", () => {
    expect(parseImpactDollars("costs $500")).toEqual({});
  });
});

describe("computeCostExposure", () => {
  it("returns nulls with no findings", () => {
    expect(computeCostExposure([], {})).toEqual({ perPc: null, nre: null });
  });

  it("sums per-piece and NRE across findings", () => {
    const out = computeCostExposure(
      [finding("A", "$0.10–0.20/pc"), finding("B", "$0.05/pc"), finding("C", "$10K–20K")],
      {},
    );
    expect(out.perPc![0]).toBeCloseTo(0.15);
    expect(out.perPc![1]).toBeCloseTo(0.25);
    expect(out.nre).toEqual([10000, 20000]);
  });

  it("excludes resolved and accepted_risk findings", () => {
    const findings = [finding("A", "$1.00/pc"), finding("B", "$2.00/pc"), finding("C", "$4.00/pc")];
    const workflow: Partial<Record<string, GapWorkflowStatus>> = {
      A: "resolved",
      B: "accepted_risk",
    };
    expect(computeCostExposure(findings, workflow).perPc).toEqual([4, 4]);
  });

  it("counts in_review and open findings", () => {
    const findings = [finding("A", "$1.00/pc"), finding("B", "$2.00/pc")];
    const out = computeCostExposure(findings, { A: "in_review", B: "open" });
    expect(out.perPc).toEqual([3, 3]);
  });

  it("treats a finding with no recorded status as open", () => {
    expect(computeCostExposure([finding("A", "$1.00/pc")], undefined).perPc).toEqual([1, 1]);
  });

  it("returns null when every finding is closed", () => {
    expect(computeCostExposure([finding("A", "$1.00/pc")], { A: "resolved" })).toEqual({
      perPc: null,
      nre: null,
    });
  });

  it("ignores findings whose impact has no dollar figure", () => {
    expect(computeCostExposure([finding("A", "Schedule risk")], {})).toEqual({
      perPc: null,
      nre: null,
    });
  });
});

describe("riskTone", () => {
  it("bands on 35 and 55", () => {
    expect(riskTone(0)).toBe("good");
    expect(riskTone(34)).toBe("good");
    expect(riskTone(35)).toBe("warn");
    expect(riskTone(54)).toBe("warn");
    expect(riskTone(55)).toBe("bad");
    expect(riskTone(100)).toBe("bad");
  });
});
