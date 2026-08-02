import { describe, expect, it } from "vitest";

import type { CaseData, DocEntry, GapFinding } from "@/data/rfqTypes";
import { DOC_GAP_CONF_THRESHOLD } from "@/lib/rfq/reconcileGapsWithDocuments";
import { resolveGapSupplyState } from "@/lib/rfq/gapSupplyState";

function caseWith(docs: Partial<DocEntry>[], over: Partial<CaseData> = {}): CaseData {
  return { docs, gap_findings: [], ...over } as unknown as CaseData;
}

function gap(over: Partial<GapFinding> = {}): GapFinding {
  return { rule: "R1", sev: "high", cat: "completeness", ...over } as GapFinding;
}

/**
 * `supplyLabel` was a four-deep nested ternary in the row component. These pin
 * the branch it picks for every state a slot's document can be in.
 */
describe("resolveGapSupplyState — supplyLabel", () => {
  it("is null when the gap has no supply slot", () => {
    const c = caseWith([{ name: "Other.pdf" }]);
    expect(resolveGapSupplyState(c, gap()).supplyLabel).toBeNull();
  });

  it("offers 'Response' for an empty slot", () => {
    const c = caseWith([{ name: "Spec.pdf", status: "miss" }]);
    expect(resolveGapSupplyState(c, gap({ doc_slot: "Spec.pdf" })).supplyLabel).toBe("Response");
  });

  it("offers 'Replace' once a document is supplied", () => {
    const c = caseWith([{ name: "Spec.pdf", status: "miss", supplied_label: "mine.pdf" }]);
    expect(resolveGapSupplyState(c, gap({ doc_slot: "Spec.pdf" })).supplyLabel).toBe("Replace");
  });

  it("offers 'Replace' once finalized", () => {
    const c = caseWith([{ name: "Spec.pdf", status: "miss", finalized: true }]);
    expect(resolveGapSupplyState(c, gap({ doc_slot: "Spec.pdf" })).supplyLabel).toBe("Replace");
  });

  it("offers nothing for a confidently matched document", () => {
    // `gapFinalizeSupplySlot` returns no slot once a document matched cleanly,
    // so there is nothing to supply and the button is hidden entirely.
    const c = caseWith([{ name: "Spec.pdf", status: "ok", conf: 0.95 }]);
    const state = resolveGapSupplyState(c, gap({ doc_slot: "Spec.pdf" }));
    expect(state.supplySlot).toBeNull();
    expect(state.supplyLabel).toBeNull();
  });

  it("offers 'Replace' for a low-confidence match", () => {
    const c = caseWith([
      { name: "Spec.pdf", status: "ok", conf: DOC_GAP_CONF_THRESHOLD - 0.01 },
    ]);
    expect(resolveGapSupplyState(c, gap({ doc_slot: "Spec.pdf" })).supplyLabel).toBe("Replace");
  });

  it("offers 'Response' for a pending slot with nothing attached", () => {
    const c = caseWith([{ name: "Spec.pdf", status: "pend" }]);
    expect(resolveGapSupplyState(c, gap({ doc_slot: "Spec.pdf" })).supplyLabel).toBe("Response");
  });
});

describe("resolveGapSupplyState — other fields", () => {
  it("defaults workflow to open", () => {
    const c = caseWith([{ name: "Spec.pdf" }]);
    expect(resolveGapSupplyState(c, gap()).workflow).toBe("open");
  });

  it("reads the recorded workflow status", () => {
    const c = caseWith([{ name: "Spec.pdf" }], { gap_workflow: { R1: "in_review" } });
    expect(resolveGapSupplyState(c, gap()).workflow).toBe("in_review");
  });

  it("resolves linkedDoc from doc_slot", () => {
    const c = caseWith([{ name: "Spec.pdf", note: "hi" }, { name: "Other.pdf" }]);
    expect(resolveGapSupplyState(c, gap({ doc_slot: "Spec.pdf" })).linkedDoc?.note).toBe("hi");
  });

  it("leaves linkedDoc undefined when the gap names no slot", () => {
    const c = caseWith([{ name: "Spec.pdf" }]);
    expect(resolveGapSupplyState(c, gap()).linkedDoc).toBeUndefined();
  });

  it("treats a gap as open when the case carries no gap_catalog", () => {
    // Without a catalog, `isGapOpenInCase` cannot reconcile against documents
    // and reports every non-closed finding as open.
    const c = caseWith([{ name: "Spec.pdf", supplied_label: "x.pdf", finalized: true }]);
    expect(resolveGapSupplyState(c, gap({ doc_slot: "Spec.pdf" })).closed).toBe(false);
  });

  it("marks a finalized gap closed once a gap_catalog is present", () => {
    const g = gap({ doc_slot: "Spec.pdf" });
    const c = caseWith([{ name: "Spec.pdf", supplied_label: "x.pdf", finalized: true }], {
      gap_catalog: [g],
    });
    expect(resolveGapSupplyState(c, g).closed).toBe(true);
  });

  it("marks a gap closed when its workflow status is resolved", () => {
    const c = caseWith([{ name: "Spec.pdf" }], { gap_workflow: { R1: "resolved" } });
    expect(resolveGapSupplyState(c, gap()).closed).toBe(true);
  });
});
