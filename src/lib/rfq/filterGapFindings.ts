import type { CaseData, GapFinding } from "@/data/rfqTypes";
import { isGapFinalized } from "@/lib/rfq/reconcileGapsWithDocuments";

/** Filter key applied to the Gap analysis list. */
export type GapFilterKey =
  | "all"
  | "finalized"
  | "sev-critical"
  | "sev-high"
  | "sev-medium"
  | "sev-low"
  | `cat-${string}`;

/**
 * Applies the active Gap analysis filter.
 *
 * Finalized findings are hidden from every view except the dedicated
 * "Finalized" filter — that is the rule the whole panel is built around, so it
 * is applied before any severity or category narrowing.
 */
export function filterGapFindings(caseData: CaseData | null, filter: GapFilterKey): GapFinding[] {
  if (!caseData) return [];
  const findings = caseData.gap_findings;

  if (filter === "finalized") return findings.filter((f) => isGapFinalized(caseData, f));

  const visible = findings.filter((f) => !isGapFinalized(caseData, f));
  if (filter === "all") return visible;
  if (filter.startsWith("sev-")) {
    const sev = filter.slice("sev-".length) as GapFinding["sev"];
    return visible.filter((f) => f.sev === sev);
  }
  if (filter.startsWith("cat-")) {
    const cat = filter.slice("cat-".length);
    return visible.filter((f) => f.cat === cat);
  }
  return visible;
}
