import type { CaseData, DocEntry, GapFinding, GapWorkflowStatus } from "@/data/rfqTypes";

/** Document confidence below this keeps a linked gap open (demo + workbook UI). */
export const DOC_GAP_CONF_THRESHOLD = 0.85;

/** @deprecated Use {@link DOC_GAP_CONF_THRESHOLD}. */
export const COMM_MISMATCH_CONF_THRESHOLD = DOC_GAP_CONF_THRESHOLD;

function sumCostBreakdown(b: CaseData["quote"]["cost_breakdown"]): number {
  return (
    b.material +
    b.labor +
    b.machine +
    b.overhead +
    b.scrap +
    b.quality +
    b.logistics +
    b.packaging
  );
}

/**
 * Whether a catalog gap should still appear, given package document rows.
 * Linked gaps use {@link GapFinding.doc_slot} === {@link DocEntry.name}.
 */
export function gapStillOpenForDocuments(g: GapFinding, docs: DocEntry[]): boolean {
  if (!g.doc_slot) return true;
  const doc = docs.find((d) => d.name === g.doc_slot);
  if (!doc) return true;
  if (doc.finalized) return false;
  if (doc.status === "miss" || doc.status === "pend") return true;
  if (doc.conf !== null && doc.conf < DOC_GAP_CONF_THRESHOLD) return true;
  return false;
}

export function filterGapsByDocuments(catalog: GapFinding[], docs: DocEntry[]): GapFinding[] {
  return catalog.filter((g) => gapStillOpenForDocuments(g, docs));
}

export type GapDocumentStatus = "none" | "missing" | "pending" | "partial" | "supplied" | "finalized";

/** UI status for a gap linked to a package document row. */
export function gapDocumentStatus(g: GapFinding, docs: DocEntry[]): GapDocumentStatus {
  if (!g.doc_slot) return "none";
  const doc = docs.find((d) => d.name === g.doc_slot);
  if (!doc || doc.status === "miss") return "missing";
  if (doc.status === "pend") return "pending";
  if (doc.finalized) return "finalized";
  if (doc.conf !== null && doc.conf < DOC_GAP_CONF_THRESHOLD) return "partial";
  return "supplied";
}

export function isGapWorkflowClosed(w: GapWorkflowStatus | undefined): boolean {
  return w === "resolved" || w === "accepted_risk";
}

/** Whether a gap still needs action (document + workflow) in catalog-backed sessions. */
export function isGapOpenInCase(
  c: Pick<CaseData, "gap_catalog" | "gap_workflow" | "docs">,
  g: GapFinding,
): boolean {
  if (isGapWorkflowClosed(c.gap_workflow?.[g.rule])) return false;
  if (c.gap_catalog?.length) return gapStillOpenForDocuments(g, c.docs);
  return true;
}

function demoRiskScore(docs: DocEntry[], gapFindings: GapFinding[]): number {
  const miss = docs.filter((d) => d.status === "miss").length;
  const pend = docs.filter((d) => d.status === "pend").length;
  const high = gapFindings.filter((x) => x.sev === "high").length;
  const med = gapFindings.filter((x) => x.sev === "medium").length;
  const raw = 8 + miss * 9 + pend * 10 + high * 7 + med * 3 + gapFindings.length * 2;
  return Math.min(92, Math.max(18, raw));
}

/**
 * Recomputes gap list, triggered rules, risk, completeness, quote hints, and workflow keys
 * from `docs` + `gap_catalog` (bundled demo sessions).
 */
export function reconcileCaseGapsWithDocuments(c: CaseData): CaseData {
  if (!c.gap_catalog?.length) return c;

  const gap_findings = c.gap_catalog;
  const openGaps = filterGapsByDocuments(c.gap_catalog, c.docs);
  const triggered_rules = [...new Set(openGaps.map((g) => g.rule))];

  const wf = { ...(c.gap_workflow ?? {}) };
  for (const g of c.gap_catalog) {
    if (!gapStillOpenForDocuments(g, c.docs) && (wf[g.rule] ?? "open") === "open") {
      wf[g.rule] = "resolved";
    }
  }

  const missingCount = c.docs.filter((d) => d.status === "miss").length;
  const completeness: CaseData["completeness"] =
    missingCount === 0 ? "complete" : c.completeness === "missing" ? "missing" : "incomplete";
  const status_label =
    missingCount === 0 ? "Ready" : missingCount >= 2 ? "Incomplete" : "Review";

  const risk_score = demoRiskScore(c.docs, openGaps);
  let quote = { ...c.quote, risk_score };

  const packagingGapOpen = openGaps.some((g) => g.rule === "RULE_001");
  const pkgDoc = c.docs.find((d) => d.type === "pkg");
  if (!packagingGapOpen && pkgDoc?.status === "ok" && quote.lines.length > 0) {
    const pkgVal = quote.lines[0]!.pkg > 0 ? quote.lines[0]!.pkg : 0.1;
    const lines = quote.lines.map((L, i) => (i === 0 ? { ...L, pkg: pkgVal } : L));
    const cost_breakdown = { ...quote.cost_breakdown, packaging: pkgVal };
    cost_breakdown.total = Math.round(sumCostBreakdown(cost_breakdown) * 100) / 100;
    quote = { ...quote, lines, cost_breakdown };
  }

  if (missingCount === 0 && openGaps.length === 0) {
    const line0 = quote.lines[0];
    const total_value =
      line0 != null ? Math.round((line0.vol * line0.price + line0.tooling) * 100) / 100 : quote.total_value;
    quote = {
      ...quote,
      version: quote.version.includes("Blocked") ? "v1 Draft" : quote.version,
      validity: quote.validity ?? 30,
      total_value: total_value ?? quote.total_value,
    };
  }

  return {
    ...c,
    gap_findings,
    triggered_rules,
    gap_workflow: wf,
    completeness,
    status_label,
    risk_score,
    quote,
  };
}

/**
 * Document row to use for the Gap Analysis “Upload / Replace” control on this finding.
 */
export function gapFindingUploadSlot(c: CaseData, f: GapFinding): string | null {
  if (f.doc_slot) {
    const doc = c.docs.find((d) => d.name === f.doc_slot);
    if (!doc) return f.doc_slot;
    if (doc.supplied_label || doc.finalized) return f.doc_slot;
    if (doc.status === "miss" || doc.status === "pend") return f.doc_slot;
    if (doc.conf !== null && doc.conf < DOC_GAP_CONF_THRESHOLD) return f.doc_slot;
    return null;
  }
  return null;
}
