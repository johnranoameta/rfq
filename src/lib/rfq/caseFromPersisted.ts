import type { CaseData, DocEntry, DocType, GapFinding, HistoricalEntry, Quote, QuoteLine } from "@/data/rfqTypes";
import type { GapAnalysisResult } from "@/lib/rfq/gapFromParsed";
import type { RankedHistoricalMatch } from "@/lib/rfq/loadHistoricalKnowledge";
import type { RfqParseSessionFull } from "@/lib/rfq/sqlite/parseSessions";

function attachmentTypeToDocType(t: string): DocType {
  switch (t) {
    case "cost_template":
      return "cost";
    case "drawing":
      return "draw";
    case "packaging_spec":
      return "pkg";
    case "test_standard":
      return "test";
    case "supplier_questionnaire":
      return "q";
    case "tech_spec":
      return "tech";
    case "quality_csr":
      return "qual";
    case "commercial_terms":
      return "comm";
    case "nda":
      return "nda";
    case "rfq_main":
      return "rfq";
    default:
      return "rfq";
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : 0;
}

function firstLineItem(parsed: Record<string, unknown>): Record<string, unknown> | null {
  const items = parsed.line_items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const row = items[0];
  return typeof row === "object" && row !== null ? (row as Record<string, unknown>) : null;
}

function buildDocsFromParsed(parsed: Record<string, unknown>): DocEntry[] {
  const main: DocEntry = {
    name: "RFQ (from stored analysis)",
    type: "rfq",
    status: "ok",
    conf: 0.92,
    note: "Reconstructed from database snapshot",
  };

  const raw = parsed.required_attachments;
  if (!Array.isArray(raw)) return [main];

  const rest: DocEntry[] = raw
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((a) => {
      const file_name = typeof a.file_name === "string" ? a.file_name : "attachment";
      const type = typeof a.type === "string" ? a.type : "rfq";
      const included = a.included === true;
      return {
        name: file_name,
        type: attachmentTypeToDocType(type),
        status: included ? ("ok" as const) : ("miss" as const),
        conf: included ? 0.88 : null,
        note: included ? "Marked included in parse" : "Missing or not included in parse",
      };
    });

  return [main, ...rest];
}

function gapFindingsFromPersisted(gap: GapAnalysisResult): GapFinding[] {
  const out: GapFinding[] = [];
  let ri = 0;
  for (const m of gap.missing_attachments) {
    const rule = gap.triggered_rules[ri] ?? "RULE_027";
    ri = (ri + 1) % Math.max(1, gap.triggered_rules.length);
    out.push({
      rule,
      sev: "high",
      cat: "completeness",
      title: `Missing / unresolved: ${m}`,
      detail: gap.summary,
      impact: "Blocks or constrains quote readiness",
      evidence: m,
      action: gap.recommended_actions[0] ?? "Clarify with customer",
    });
  }
  for (const h of gap.historical_issues) {
    out.push({
      rule: h.issue_code,
      sev: "medium",
      cat: "quality",
      title: h.issue_summary,
      detail: h.notes,
      impact: "Observed on matched historical programs",
      evidence: h.project_id,
      action: "Review against current package",
      hist: {
        projects: [h.project_id],
        label: h.issue_code,
        hist_val: h.resolved_in_final_quote ? "Resolved (hist.)" : "Open (hist.)",
        curr_val: "—",
      },
    });
  }
  if (out.length === 0) {
    out.push({
      rule: "GAP_SUMMARY",
      sev: "low",
      cat: "completeness",
      title: "Gap review",
      detail: gap.summary,
      impact: "—",
      evidence: "—",
      action: gap.recommended_actions.join("; ") || "—",
    });
  }
  return out;
}

function matchesToHistoricalEntries(matches: RankedHistoricalMatch[]): HistoricalEntry[] {
  return matches.slice(0, 12).map((m) => {
    const r = m.record.rfq;
    const q = m.record.quote_result;
    const awardRaw = String(q.award_result ?? "").toLowerCase();
    const award: HistoricalEntry["award"] = awardRaw === "won" ? "Won" : "Lost";
    return {
      id: m.project_id,
      pn: r.part_number,
      name: r.part_name,
      material: r.material,
      vol: r.annual_volume,
      ppap: r.ppap_level,
      incoterm: r.incoterm,
      terms: r.payment_terms,
      apd: r.annual_reduction_pct,
      price: q.quoted_piece_price_usd,
      tooling: q.tooling_cost_usd,
      pkg: q.packaging_cost_per_pc,
      award,
    };
  });
}

function estimateQuote(
  parsed: Record<string, unknown>,
  matches: RankedHistoricalMatch[],
  gap: GapAnalysisResult,
): Quote {
  const prices = matches
    .map((m) => m.record.quote_result.quoted_piece_price_usd)
    .filter((p) => typeof p === "number" && p > 0);
  const toolings = matches
    .map((m) => m.record.quote_result.tooling_cost_usd)
    .filter((t) => typeof t === "number" && t > 0);

  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 4.2;
  const avgTool = toolings.length ? toolings.reduce((a, b) => a + b, 0) / toolings.length : 42000;
  const hist_price_band: [number, number] =
    prices.length >= 2 ? [Math.min(...prices), Math.max(...prices)] : [avgPrice * 0.98, avgPrice * 1.02];
  const hist_tooling_band: [number, number] =
    toolings.length >= 2 ? [Math.min(...toolings), Math.max(...toolings)] : [avgTool * 0.95, avgTool * 1.05];

  const items = Array.isArray(parsed.line_items) ? (parsed.line_items as Record<string, unknown>[]) : [];

  const lines: QuoteLine[] =
    items.length > 0
      ? items.map((row, i) => ({
          pn: str(row.part_number) || `LINE-${i + 1}`,
          name: str(row.part_name) || "—",
          plant: `PLT-${String(i + 1).padStart(2, "0")}`,
          vol: typeof row.annual_volume === "number" ? row.annual_volume : num(parsed.annual_volume),
          price: Math.round(avgPrice * 100) / 100,
          tooling: Math.round(avgTool / items.length),
          pkg: 0.08,
          quality: 0.12,
          freight: 0.05,
          margin: 14.2,
        }))
      : [
          {
            pn: str(parsed.part_number) || "—",
            name: str(parsed.part_name) || "—",
            plant: "PLT-02",
            vol: num(parsed.annual_volume),
            price: Math.round(avgPrice * 100) / 100,
            tooling: Math.round(avgTool),
            pkg: 0.08,
            quality: 0.12,
            freight: 0.05,
            margin: 14.2,
          },
        ];

  const lead = lines[0]!;
  const price = lead.price;
  const material = Math.round(price * 0.62 * 100) / 100;
  const labor = Math.round(price * 0.1 * 100) / 100;
  const machine = Math.round(price * 0.13 * 100) / 100;
  const overhead = Math.round(price * 0.08 * 100) / 100;
  const scrap = Math.round(price * 0.02 * 100) / 100;
  const quality = lead.quality;
  const logistics = lead.freight;
  const packaging = lead.pkg;
  const total = Math.round((material + labor + machine + overhead + scrap + quality + logistics + packaging) * 100) / 100;

  return {
    version: "v1 Draft — from stored analysis",
    prepared_by: "RFQ Agent (DB)",
    validity: null,
    total_value: null,
    total_tooling: lines.reduce((s, l) => s + l.tooling, 0),
    risk_score: gap.risk_score,
    lines,
    cost_breakdown: {
      material,
      labor,
      machine,
      overhead,
      scrap,
      quality,
      logistics,
      packaging,
      total,
    },
    hist_match: matches.slice(0, 6).map((m) => m.project_id),
    hist_price_band,
    hist_tooling_band,
  };
}

/**
 * Rebuild dashboard {@link CaseData} from a persisted SQLite row (no upload file required).
 */
export function buildCaseDataFromPersisted(
  row: RfqParseSessionFull,
  file: { id: string; originalName: string },
): CaseData {
  const parsed = row.parse.parsed;
  const gap = row.gap;
  const matches = row.historical.matches;

  const dc = str(parsed.document_completeness) || "incomplete";
  const completeness: CaseData["completeness"] =
    dc === "complete" ? "complete" : dc === "missing" ? "missing" : "incomplete";

  const status_label =
    gap.completeness_status === "fail" ? "Incomplete" : gap.completeness_status === "pass" ? "Ready" : "Review";

  const li = firstLineItem(parsed);
  const processFromParsed = Array.isArray(parsed.process_family)
    ? (parsed.process_family as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const process =
    processFromParsed.length > 0
      ? processFromParsed
      : li && typeof li.process === "string"
        ? [li.process]
        : ["stamping"];

  const partName =
    ((li && typeof li.part_name === "string" ? li.part_name : null) ?? str(parsed.part_name)) || "RFQ";
  const partNumber =
    ((li && typeof li.part_number === "string" ? li.part_number : null) ?? str(parsed.part_number)) || "—";
  const annualVol =
    (li && typeof li.annual_volume === "number" ? li.annual_volume : null) ?? num(parsed.annual_volume);
  const sop = ((li && typeof li.sop_date === "string" ? li.sop_date : null) ?? str(parsed.sop_date)) || "—";
  const tol =
    (li && typeof li.general_tolerance_mm === "number" ? li.general_tolerance_mm : null) ??
    num(parsed.general_tolerance_mm);
  const mat =
    ((li && typeof li.material_grade === "string" ? li.material_grade : null) ?? str(parsed.material_grade)) || "—";
  const thick = num(parsed.thickness_mm);
  const ppap = ((li && typeof li.ppap_level === "number" ? li.ppap_level : null) ?? num(parsed.ppap_level)) || 3;

  return {
    id: `db-${row.session_id.slice(0, 8)}`,
    rfq_num: str(parsed.rfq_reference) || `RFQ-DB-${file.id.slice(0, 8)}`,
    title: partName,
    customer: str(parsed.customer) || row.customer_name || "—",
    program: str(parsed.program) || row.program_name || "—",
    part_number: partNumber,
    sop,
    annual_vol: annualVol,
    material: mat,
    thickness: thick,
    tolerance: tol ? `±${tol} mm` : "—",
    critical_tol: "Per drawing / RFQ",
    ppap,
    cpk: "Not specified",
    surface: ["Per RFQ"],
    incoterm: str(parsed.incoterm) || "—",
    payment: str(parsed.payment_terms) || "—",
    apd: num(parsed.annual_reduction_pct),
    currency: "USD",
    tooling_owner: "Not specified",
    process,
    risk_score: gap.risk_score,
    completeness,
    status_label,
    docs: buildDocsFromParsed(parsed),
    triggered_rules: [...gap.triggered_rules],
    gap_findings: gapFindingsFromPersisted(gap),
    gap_workflow: {},
    quote: estimateQuote(parsed, matches, gap),
    historical_benchmark: matchesToHistoricalEntries(matches),
  };
}
