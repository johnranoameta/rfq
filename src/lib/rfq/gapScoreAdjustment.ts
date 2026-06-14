import type { CaseData, GapSeverity, GapWorkflowStatus } from "@/data/rfqTypes";

const SEV_WEIGHT: Record<GapSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const STATUS_CREDIT: Record<GapWorkflowStatus, number> = {
  resolved: 1.0,
  accepted_risk: 1.0,
  in_review: 0.5,
  open: 0,
};

/**
 * Returns a score bonus (0–10) earned by the user's gap workflow responses.
 * Severity-weighted: closing critical gaps earns more than closing low ones.
 * Apply to the raw historical match score for display only — never mutate the raw data.
 */
export function computeGapAdjustment(
  caseData: Pick<CaseData, "gap_findings" | "gap_workflow">,
): number {
  const findings = caseData.gap_findings;
  if (!findings || findings.length === 0) return 0;

  let totalWeight = 0;
  let weightedCreditSum = 0;

  for (const f of findings) {
    const weight = SEV_WEIGHT[f.sev] ?? 1;
    const status: GapWorkflowStatus = caseData.gap_workflow?.[f.rule] ?? "open";
    const credit = STATUS_CREDIT[status] ?? 0;
    totalWeight += weight;
    weightedCreditSum += weight * credit;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedCreditSum / totalWeight) * 10);
}

export function clampDisplayScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
