import { describe, it, expect } from "vitest";
import type { CaseData, DocEntry, GapFinding } from "@/data/rfqTypes";
import {
  gapFinalizeSupplySlot,
  isGapFinalized,
} from "@/lib/rfq/reconcileGapsWithDocuments";

function caseWith(docs: Partial<DocEntry>[]): CaseData {
  return { docs } as unknown as CaseData;
}

function gap(overrides: Partial<GapFinding>): GapFinding {
  return { rule: "RULE_X", ...overrides } as GapFinding;
}

describe("isGapFinalized", () => {
  it("is true when the gap's doc_slot document is finalized", () => {
    const c = caseWith([
      { name: "Spec.pdf", supplied_label: "user.pdf", finalized: true },
    ]);
    const f = gap({ doc_slot: "Spec.pdf" });
    expect(isGapFinalized(c, f)).toBe(true);
  });

  it("is false when the doc_slot document is supplied but not finalized", () => {
    const c = caseWith([
      { name: "Spec.pdf", supplied_label: "user.pdf", finalized: false },
    ]);
    const f = gap({ doc_slot: "Spec.pdf" });
    expect(isGapFinalized(c, f)).toBe(false);
  });

  it("is false when no supply slot can be resolved", () => {
    const c = caseWith([{ name: "Other.pdf" }]);
    const f = gap({ rule: "RULE_UNKNOWN" });
    expect(isGapFinalized(c, f)).toBe(false);
  });

  it("is false for a dropdown-resolved gap whose doc is not finalized", () => {
    const c = caseWith([
      { name: "Spec.pdf", supplied_label: "user.pdf", finalized: false },
    ]);
    const f = gap({ doc_slot: "Spec.pdf" });
    expect(isGapFinalized(c, f)).toBe(false);
  });

  it("resolves the legacy supply slot for known rules", () => {
    const c = caseWith([
      { name: "Pkg.pdf", type: "pkg", status: "miss", finalized: true },
    ]);
    const f = gap({ rule: "RULE_001" });
    expect(gapFinalizeSupplySlot(c, f)).toBe("Pkg.pdf");
    expect(isGapFinalized(c, f)).toBe(true);
  });
});
