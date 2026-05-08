import OpenAI from "openai";

import type { GapAnalysisResult } from "@/lib/rfq/gapFromParsed";
import type { RankedHistoricalMatch } from "@/lib/rfq/loadHistoricalKnowledge";

const SYSTEM = `You are an RFQ gap analysis assistant for automotive / industrial sourcing.
Compare the parsed RFQ against the historical match summaries and the heuristic checklist.
Identify gaps in: document completeness, missing or unclear requirements, likely supplier deviations or assumptions,
price or commercial anomalies vs historical benchmarks, and capability / process mismatches.

When parsed_rfq.source_form is "four_sheet_workbook", the RFQ came from a 4-sheet Excel model:
(1) Header — OEM, region, SOP, annual volume (pricing & feasibility context).
(2) Line_Items — material, process, tooling flag, target price; part names may be messy — match carefully to specs and quotes.
(3) Technical_Specs — semi-structured text; may be incomplete — infer conservatively and flag uncertainty.
(4) Supplier_Responses — multiple rows per supplier (one row per supplier × line item). Assess deviations and assumptions per row,
and consistency across all items that supplier quoted. Do not collapse multi-line suppliers into a single product.

Return JSON only, no markdown.

Required output shape (exact keys):
{
  "risk_score_0_1": number,
  "completeness_status": "pass" | "fail",
  "missing_attachments": string[],
  "triggered_rules": string[],
  "summary": string,
  "recommended_actions": string[],
  "item_gaps": { "item": string, "gaps": string[] }[]
}

Rules:
- risk_score_0_1 is overall RFQ risk from 0 (low) to 1 (high).
- completeness_status is "pass" only if the package appears sufficient to quote with acceptable residual risk; otherwise "fail".
- missing_attachments: concrete missing documents, references, or unclear items (short strings). Merge with heuristic suggestions when appropriate.
- triggered_rules: short codes (e.g. RULE_PACK, RULE_VAL, RULE_PRICE). You may keep relevant heuristic codes.
- item_gaps: for each major line item / part, list specific gap bullets; use [] if none.
- recommended_actions: 2–5 actionable next steps.
- Be conservative: if information is missing from the parse, call it out as a gap rather than inventing data.`;

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/** Map 0–1 risk to existing dashboard scale 18–94 (higher = riskier). */
function risk0toDashboard(r0: number): number {
  const r = clamp01(r0);
  return Math.min(94, Math.max(18, Math.round(18 + r * 76)));
}

function compactForPrompt(parsed: Record<string, unknown>): Record<string, unknown> {
  let o: Record<string, unknown> = { ...parsed };

  if (o.source_form === "four_sheet_workbook") {
    const line_items = Array.isArray(o.line_items) ? (o.line_items as unknown[]).slice(0, 40) : [];
    const technical_specs = Array.isArray(o.technical_specs)
      ? (o.technical_specs as unknown[]).slice(0, 40)
      : [];
    const suppliers_grouped = Array.isArray(o.suppliers_grouped)
      ? (o.suppliers_grouped as unknown[]).slice(0, 30)
      : [];
    const flat = Array.isArray(o.supplier_responses_flat)
      ? (o.supplier_responses_flat as unknown[]).slice(0, 80)
      : [];
    return {
      source_form: o.source_form,
      workbook_header: o.workbook_header,
      customer: o.customer,
      program: o.program,
      rfq_reference: o.rfq_reference,
      line_items,
      technical_specs,
      suppliers_grouped,
      supplier_responses_flat: flat,
      _truncation_note:
        line_items.length >= 40 || technical_specs.length >= 40
          ? "Some rows omitted for length; prioritize grouped suppliers and deviations."
          : undefined,
    };
  }

  if (Array.isArray(o.line_items) && o.line_items.length > 15) {
    o = { ...o, line_items: o.line_items.slice(0, 15), _line_items_truncated: true };
  }
  if (Array.isArray(o.required_attachments) && o.required_attachments.length > 50) {
    o = {
      ...o,
      required_attachments: o.required_attachments.slice(0, 50),
      _attachments_truncated: true,
    };
  }
  let s = JSON.stringify(o);
  if (s.length <= 24_000) return o;
  o = { ...parsed };
  if (Array.isArray(o.line_items)) o.line_items = (o.line_items as unknown[]).slice(0, 8);
  s = JSON.stringify(o);
  if (s.length <= 24_000) return o;
  return { rfq_reference: o.rfq_reference, customer: o.customer, program: o.program, _truncated: true };
}

function compactMatches(matches: RankedHistoricalMatch[], limit: number) {
  return matches.slice(0, limit).map((m) => ({
    project_id: m.project_id,
    score: m.score,
    reasons: m.reasons,
    rfq: {
      customer: m.record.rfq.customer,
      program: m.record.rfq.program,
      part_name: m.record.rfq.part_name,
      part_number: m.record.rfq.part_number,
      material: m.record.rfq.material,
      process: m.record.rfq.process,
      annual_volume: m.record.rfq.annual_volume,
    },
    quote: {
      piece_price: m.record.quote_result.quoted_piece_price_usd,
      tooling: m.record.quote_result.tooling_cost_usd,
      award: m.record.quote_result.award_result,
    },
    notes: m.record.notes,
  }));
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
}

function asItemGaps(v: unknown): { item: string; gaps: string[] }[] {
  if (!Array.isArray(v)) return [];
  const out: { item: string; gaps: string[] }[] = [];
  for (const row of v) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const item = typeof o.item === "string" ? o.item : "";
    const gaps = asStrArray(o.gaps);
    if (item) out.push({ item, gaps });
  }
  return out;
}

/**
 * OpenAI-based gap analysis using parsed extraction + ranked historical projects + heuristic baseline.
 * Preserves {@link GapAnalysisResult.historical_issues} from the caller (CSV-backed).
 */
export async function runOpenAiGapAnalysis(params: {
  apiKey: string;
  parsed: Record<string, unknown>;
  matches: RankedHistoricalMatch[];
  heuristicGap: GapAnalysisResult;
}): Promise<GapAnalysisResult> {
  const { apiKey, parsed, matches, heuristicGap } = params;
  const model =
    process.env.OPENAI_MODEL_GAP?.trim() ||
    process.env.OPENAI_MODEL_TEXT?.trim() ||
    "gpt-4o-mini";

  const client = new OpenAI({ apiKey });

  const userPayload = {
    parsed_rfq: compactForPrompt(parsed),
    historical_matches: compactMatches(matches, 8),
    heuristic_baseline: {
      missing_attachments: heuristicGap.missing_attachments,
      completeness_status: heuristicGap.completeness_status,
      triggered_rules: heuristicGap.triggered_rules,
      summary: heuristicGap.summary,
      risk_score_numeric: heuristicGap.risk_score,
    },
  };

  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Analyze gaps and risk. Input JSON:\n${JSON.stringify(userPayload)}`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim() ?? "";
  const obj = parseJsonObject(raw);

  const r01 =
    typeof obj.risk_score_0_1 === "number"
      ? clamp01(obj.risk_score_0_1)
      : typeof obj.risk_score === "number" && obj.risk_score <= 1 && obj.risk_score >= 0
        ? clamp01(obj.risk_score)
        : 0.5;

  const completeness_status: "pass" | "fail" =
    obj.completeness_status === "pass" ? "pass" : "fail";

  const missing_llm = asStrArray(obj.missing_attachments);
  const missing = [...new Set([...missing_llm, ...heuristicGap.missing_attachments])];

  const triggered = asStrArray(obj.triggered_rules);
  const triggered_rules = [...new Set([...triggered, ...heuristicGap.triggered_rules])];

  const summary = typeof obj.summary === "string" ? obj.summary : heuristicGap.summary;
  const recommended_actions = asStrArray(obj.recommended_actions);
  const rec =
    recommended_actions.length > 0 ? recommended_actions : heuristicGap.recommended_actions;

  const item_gaps = asItemGaps(obj.item_gaps);

  return {
    risk_score: risk0toDashboard(r01),
    risk_score_0_1: r01,
    gap_model: model,
    completeness_status,
    missing_attachments: missing,
    triggered_rules,
    summary,
    recommended_actions: rec,
    historical_issues: heuristicGap.historical_issues,
    item_gaps: item_gaps.length > 0 ? item_gaps : undefined,
  };
}
