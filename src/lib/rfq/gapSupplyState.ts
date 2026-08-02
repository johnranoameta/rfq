import type { CaseData, DocEntry, GapFinding, GapWorkflowStatus } from "@/data/rfqTypes";
import { gapSlotHasSessionUpload } from "@/lib/rfq/applySuppliedPackageDoc";
import {
  DOC_GAP_CONF_THRESHOLD,
  gapDocumentStatus,
  gapFinalizeSupplySlot,
  isGapOpenInCase,
} from "@/lib/rfq/reconcileGapsWithDocuments";

export type GapSupplyState = {
  workflow: GapWorkflowStatus;
  docStatus: ReturnType<typeof gapDocumentStatus>;
  /** The document this gap tracks, if it names one. */
  linkedDoc: DocEntry | undefined;
  closed: boolean;
  /** Slot name a document can be supplied into, or null when the gap takes none. */
  supplySlot: string | null;
  supplySlotDoc: DocEntry | undefined;
  /** Button copy: "Response" for a first upload, "Replace" once something is there. */
  supplyLabel: string | null;
  /** True when the current session supplied the file, so it can still be removed. */
  sessionUpload: boolean;
};

/**
 * Everything the gap row needs to know about a finding's document slot.
 *
 * Extracted from the row component because the `supplyLabel` decision was a
 * four-deep nested ternary — the single biggest contributor to that
 * component's complexity, and the part most worth pinning with tests.
 */
export function resolveGapSupplyState(caseData: CaseData, f: GapFinding): GapSupplyState {
  const supplySlot = gapFinalizeSupplySlot(caseData, f);
  const supplySlotDoc = supplySlot
    ? caseData.docs.find((d) => d.name === supplySlot)
    : undefined;

  return {
    workflow: caseData.gap_workflow?.[f.rule] ?? "open",
    docStatus: gapDocumentStatus(f, caseData.docs),
    linkedDoc: f.doc_slot ? caseData.docs.find((d) => d.name === f.doc_slot) : undefined,
    closed: !isGapOpenInCase(caseData, f),
    supplySlot,
    supplySlotDoc,
    supplyLabel: resolveSupplyLabel(supplySlot, supplySlotDoc),
    sessionUpload: supplySlot != null && gapSlotHasSessionUpload(caseData, supplySlot),
  };
}

/**
 * Anything already attached — supplied, finalized, or matched with any
 * confidence — reads as "Replace"; only a slot with nothing in it offers
 * "Response". A slot that does not exist offers nothing.
 */
function resolveSupplyLabel(
  supplySlot: string | null,
  doc: DocEntry | undefined,
): string | null {
  if (!supplySlot) return null;
  if (!doc) return "Response";
  const lowConfidenceMatch =
    doc.status === "ok" && doc.conf != null && doc.conf < DOC_GAP_CONF_THRESHOLD;
  if (lowConfidenceMatch || doc.supplied_label || doc.finalized || doc.status === "ok") {
    return "Replace";
  }
  return "Response";
}
