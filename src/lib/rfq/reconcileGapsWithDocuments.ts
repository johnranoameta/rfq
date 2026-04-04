import type { CaseData, DocEntry, GapFinding } from "@/data/rfqTypes";

/** Commercial row still counts as a “mismatch” gap while confidence is below this (demo). */
export const COMM_MISMATCH_CONF_THRESHOLD = 0.85;

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
  if (doc.status === "miss" || doc.status === "pend") return true;
  if (doc.type === "comm" && doc.conf !== null && doc.conf < COMM_MISMATCH_CONF_THRESHOLD) return true;
  return false;
}

export function filterGapsByDocuments(catalog: GapFinding[], docs: DocEntry[]): GapFinding[] {
  return catalog.filter((g) => gapStillOpenForDocuments(g, docs));
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

  const gap_findings = filterGapsByDocuments(c.gap_catalog, c.docs);
  const triggered_rules = [...new Set(gap_findings.map((g) => g.rule))];

  const wf = { ...(c.gap_workflow ?? {}) };
  for (const key of Object.keys(wf)) {
    if (!gap_findings.some((g) => g.rule === key)) delete wf[key];
  }

  const missingCount = c.docs.filter((d) => d.status === "miss").length;
  const completeness: CaseData["completeness"] =
    missingCount === 0 ? "complete" : c.completeness === "missing" ? "missing" : "incomplete";
  const status_label =
    missingCount === 0 ? "Ready" : missingCount >= 2 ? "Incomplete" : "Review";

  const risk_score = demoRiskScore(c.docs, gap_findings);
  let quote = { ...c.quote, risk_score };

  const packagingGapOpen = gap_findings.some((g) => g.rule === "RULE_001");
  const pkgDoc = c.docs.find((d) => d.type === "pkg");
  if (!packagingGapOpen && pkgDoc?.status === "ok" && quote.lines.length > 0) {
    const pkgVal = quote.lines[0]!.pkg > 0 ? quote.lines[0]!.pkg : 0.1;
    const lines = quote.lines.map((L, i) => (i === 0 ? { ...L, pkg: pkgVal } : L));
    const cost_breakdown = { ...quote.cost_breakdown, packaging: pkgVal };
    cost_breakdown.total = Math.round(sumCostBreakdown(cost_breakdown) * 100) / 100;
    quote = { ...quote, lines, cost_breakdown };
  }

  if (missingCount === 0 && gap_findings.length === 0) {
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
    if (doc.status === "miss" || doc.status === "pend") return f.doc_slot;
    if (
      f.rule === "RULE_029" &&
      doc.type === "comm" &&
      doc.conf !== null &&
      doc.conf < COMM_MISMATCH_CONF_THRESHOLD
    ) {
      return f.doc_slot;
    }
    return null;
  }
  return null;
}
