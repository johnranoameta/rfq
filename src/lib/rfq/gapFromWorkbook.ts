import type { HistoricalGapRecord } from "@/lib/rfq/historicalKnowledgeTypes";
import type { RankedHistoricalMatch } from "@/lib/rfq/loadHistoricalKnowledge";
import type { GapAnalysisResult } from "@/lib/rfq/gapFromParsed";
import {
  normPartKey,
  techSpecForPart,
  type ParsedRfqWorkbook,
  type WorkbookSupplierRow,
} from "@/lib/rfq/parseRfqWorkbook";

function deviationMeaningful(dev: string): boolean {
  const d = dev.trim().toLowerCase();
  return d.length > 0 && d !== "none" && d !== "n/a" && d !== "na";
}

function targetForItem(w: ParsedRfqWorkbook, item: string): number | null {
  const row = w.line_items.find((l) => l.item === item || normPartKey(l.part_name) === normPartKey(item));
  return row?.target_price ?? null;
}

function priceGapSeverity(q: WorkbookSupplierRow, target: number | null): "none" | "high" {
  if (target == null || target <= 0 || q.quoted_price == null) return "none";
  if (q.quoted_price > target * 1.25) return "high";
  return "none";
}

/**
 * Rule-based gap signals from 4-sheet workbook + historical CSV rows for matched projects.
 */
export function buildGapAnalysisFromWorkbook(
  w: ParsedRfqWorkbook,
  historicalMatches: RankedHistoricalMatch[],
  allGapRecords: HistoricalGapRecord[],
): GapAnalysisResult {
  const missing_attachments: string[] = [];

  for (const li of w.line_items) {
    const spec = techSpecForPart(li.part_name, w.technical_specs);
    if (!spec || !spec.spec_text.trim()) {
      missing_attachments.push(`Technical_Specs: no usable spec for line ${li.item} (${li.part_name})`);
    } else if (spec.spec_text.trim().length < 24) {
      missing_attachments.push(`Technical_Specs: very thin spec for ${li.part_name} — review / infer requirements`);
    }
  }

  for (const q of w.supplier_responses) {
    if (deviationMeaningful(q.deviations)) {
      missing_attachments.push(`Deviation — ${q.supplier} / item ${q.item}: ${q.deviations.trim()}`);
    }
    const tgt = targetForItem(w, q.item);
    if (priceGapSeverity(q, tgt) === "high") {
      missing_attachments.push(
        `Price vs target — item ${q.item} (${q.supplier}): quoted ${q.quoted_price} vs target ${tgt}`,
      );
    }
  }

  const uniqMissing = [...new Set(missing_attachments)];

  const docComplete = uniqMissing.length === 0;
  const completeness_status: "pass" | "fail" = docComplete ? "pass" : "fail";

  let risk_score = 26;
  risk_score += uniqMissing.filter((m) => m.startsWith("Technical_Specs")).length * 10;
  risk_score += uniqMissing.filter((m) => m.startsWith("Deviation")).length * 8;
  risk_score += uniqMissing.filter((m) => m.startsWith("Price vs target")).length * 6;
  if (!docComplete) risk_score += 6;
  risk_score = Math.min(94, Math.max(18, risk_score));

  const triggered_rules: string[] = [];
  if (uniqMissing.some((m) => m.startsWith("Technical_Specs"))) triggered_rules.push("RULE_SPEC");
  if (uniqMissing.some((m) => m.startsWith("Deviation"))) triggered_rules.push("RULE_DEV");
  if (uniqMissing.some((m) => m.toLowerCase().includes("validation"))) triggered_rules.push("RULE_VAL");
  if (uniqMissing.some((m) => m.startsWith("Price vs target"))) triggered_rules.push("RULE_PRICE");
  if (completeness_status === "fail") triggered_rules.push("RULE_WB_GAP");

  const matchedIds = new Set(historicalMatches.slice(0, 6).map((m) => m.project_id));
  const historical_issues = allGapRecords.filter((g) => matchedIds.has(g.project_id));

  const summary = docComplete
    ? "Workbook structure looks complete; validate supplier assumptions and pricing vs targets before award."
    : `Workbook gap review: ${uniqMissing.length} issue(s) across specs, deviations, and/or pricing vs targets.`;

  const recommended_actions: string[] = [];
  if (uniqMissing.some((m) => m.startsWith("Technical_Specs"))) {
    recommended_actions.push("Align Technical_Specs rows with Line_Items (messy naming — use human review).");
  }
  if (uniqMissing.some((m) => m.startsWith("Deviation"))) {
    recommended_actions.push("Resolve supplier deviations per line item; same supplier may cover multiple products.");
  }
  if (uniqMissing.some((m) => m.startsWith("Price vs target"))) {
    recommended_actions.push("Reconcile quoted prices vs line-item targets (OEM + region + SOP context).");
  }
  if (historical_issues.length) {
    recommended_actions.push(
      `Review ${historical_issues.length} historical issue(s) from similar programs in the KB.`,
    );
  }
  if (recommended_actions.length === 0) {
    recommended_actions.push("Run standard commercial and engineering sign-off.");
  }

  return {
    risk_score,
    completeness_status,
    missing_attachments: uniqMissing,
    triggered_rules: [...new Set(triggered_rules)],
    summary,
    recommended_actions,
    historical_issues,
  };
}
