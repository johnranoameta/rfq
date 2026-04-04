import type { HistoricalGapRecord } from "@/lib/rfq/historicalKnowledgeTypes";
import type { RankedHistoricalMatch } from "@/lib/rfq/loadHistoricalKnowledge";

export type GapAnalysisResult = {
  risk_score: number;
  completeness_status: "pass" | "fail";
  missing_attachments: string[];
  triggered_rules: string[];
  summary: string;
  recommended_actions: string[];
  historical_issues: HistoricalGapRecord[];
};

function asAttachmentList(v: unknown): { file_name?: string; included?: boolean }[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x === "object") as { file_name?: string; included?: boolean }[];
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/**
 * Rule-based gap view from parsed JSON + historical issue rows for matched projects.
 */
export function buildGapAnalysisFromParsed(
  parsed: Record<string, unknown>,
  historicalMatches: RankedHistoricalMatch[],
  allGapRecords: HistoricalGapRecord[],
): GapAnalysisResult {
  const attachments = asAttachmentList(parsed.required_attachments);
  const missingFromChecklist = attachments
    .filter((a) => a.included === false && a.file_name)
    .map((a) => a.file_name as string);
  const missingRefs = asStringArray(parsed.missing_references);
  const missing_attachments = [...new Set([...missingFromChecklist, ...missingRefs])];

  const doc = typeof parsed.document_completeness === "string" ? parsed.document_completeness : "";
  const completeness_status: "pass" | "fail" =
    doc === "complete" && missing_attachments.length === 0 ? "pass" : "fail";

  let risk_score = 28;
  risk_score += missing_attachments.length * 12;
  if (doc === "incomplete") risk_score += 10;
  if (doc === "missing") risk_score += 22;
  risk_score = Math.min(94, Math.max(18, risk_score));

  const triggered_rules: string[] = [];
  const lower = missing_attachments.map((m) => m.toLowerCase()).join(" ");
  if (lower.includes("packag")) triggered_rules.push("RULE_001");
  if (lower.includes("test") || lower.includes("dv") || lower.includes("pv")) triggered_rules.push("RULE_002");
  if (completeness_status === "fail") triggered_rules.push("RULE_027");
  if (missingRefs.length > 0) triggered_rules.push("RULE_028");
  const uniq = [...new Set(triggered_rules)];

  const matchedIds = new Set(historicalMatches.slice(0, 6).map((m) => m.project_id));
  const historical_issues = allGapRecords.filter((g) => matchedIds.has(g.project_id));

  const summary =
    completeness_status === "pass"
      ? "Package appears complete against the parsed checklist. Validate against customer portal before quote release."
      : `Incomplete RFQ package: ${missing_attachments.length} attachment(s) or reference(s) need resolution before a clean quote release.`;

  const recommended_actions: string[] = [];
  if (missing_attachments.length) {
    recommended_actions.push(
      `Obtain or document assumptions for: ${missing_attachments.slice(0, 5).join(", ")}${missing_attachments.length > 5 ? ", …" : ""}.`,
    );
  }
  if (historical_issues.length) {
    recommended_actions.push(
      `Review ${historical_issues.length} historical issue(s) from similar awarded RFQs in the matched project set.`,
    );
  }
  if (recommended_actions.length === 0) {
    recommended_actions.push("Run commercial and tooling sign-off per standard gate checklist.");
  }

  return {
    risk_score,
    completeness_status,
    missing_attachments,
    triggered_rules: uniq,
    summary,
    recommended_actions,
    historical_issues,
  };
}
