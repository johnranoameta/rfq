import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";
import type { PersistedHistoricalPayload } from "@/lib/rfq/sqlite/parseSessions";

export type ScoreBand = "high" | "medium" | "low";

/** Reference-Score banding aligned with `RfqReferenceMatchPanel.referenceScoreBand`. */
function band(score01: number): ScoreBand {
  if (score01 >= 0.8) return "high";
  if (score01 >= 0.6) return "medium";
  return "low";
}

export type PortfolioRfqRow = {
  session_id: string;
  upload_id: string;
  original_filename: string;
  customer_name: string | null;
  program_name: string | null;
  part_number: string | null;
  rfq_reference: string | null;
  risk_score: number | null;
  total_items: number;
  items_with_match: number;
  items_high: number;
  items_medium: number;
  items_low: number;
  items_none: number;
  top_match: {
    project_id: string;
    item_label: string;
    score_0_1: number;
    band: ScoreBand;
    part_name: string;
  } | null;
  created_at: string;
};

export type PortfolioStats = {
  totalRfqs: number;
  totalItems: number;
  itemsWithMatch: number;
  itemsHigh: number;
  itemsMedium: number;
  itemsLow: number;
  itemsNone: number;
  rfqs: PortfolioRfqRow[];
};

/**
 * Aggregate per-session Reference-Score band distributions across the entire SQLite library.
 * Reads `historical_json` from each `rfq_parse_sessions` row and computes counts server-side
 * so the UI does not have to fan out N requests.
 */
export function loadPortfolioStats(): PortfolioStats {
  const db = getRfqDb();
  const rows = db
    .prepare(
      `SELECT session_id, upload_id, original_filename,
              customer_name, program_name, part_number, rfq_reference,
              risk_score, line_item_count, historical_json, created_at
       FROM rfq_parse_sessions
       ORDER BY datetime(created_at) DESC`,
    )
    .all() as Array<{
    session_id: string;
    upload_id: string;
    original_filename: string;
    customer_name: string | null;
    program_name: string | null;
    part_number: string | null;
    rfq_reference: string | null;
    risk_score: number | null;
    line_item_count: number;
    historical_json: string;
    created_at: string;
  }>;

  const out: PortfolioStats = {
    totalRfqs: 0,
    totalItems: 0,
    itemsWithMatch: 0,
    itemsHigh: 0,
    itemsMedium: 0,
    itemsLow: 0,
    itemsNone: 0,
    rfqs: [],
  };

  for (const r of rows) {
    let parsed: PersistedHistoricalPayload | null = null;
    try {
      parsed = JSON.parse(r.historical_json) as PersistedHistoricalPayload;
    } catch {
      parsed = null;
    }

    const items = Array.isArray(parsed?.per_item_matches) ? parsed!.per_item_matches : [];
    const total_items = items.length || r.line_item_count || 0;
    let items_with_match = 0;
    let items_high = 0;
    let items_medium = 0;
    let items_low = 0;
    let top: PortfolioRfqRow["top_match"] = null;

    for (const it of items) {
      const m = it.matches[0];
      if (!m) continue;
      items_with_match += 1;
      const score01 = typeof m.similarity_0_1 === "number" ? m.similarity_0_1 : m.score / 100;
      const b = band(score01);
      if (b === "high") items_high += 1;
      else if (b === "medium") items_medium += 1;
      else items_low += 1;
      if (!top || score01 > top.score_0_1) {
        top = {
          project_id: m.project_id,
          item_label: it.item_label,
          score_0_1: score01,
          band: b,
          part_name:
            (m.record?.rfq && typeof (m.record.rfq as Record<string, unknown>).part_name === "string"
              ? ((m.record.rfq as Record<string, unknown>).part_name as string)
              : "") || "",
        };
      }
    }

    const items_none = Math.max(0, total_items - items_with_match);

    out.totalRfqs += 1;
    out.totalItems += total_items;
    out.itemsWithMatch += items_with_match;
    out.itemsHigh += items_high;
    out.itemsMedium += items_medium;
    out.itemsLow += items_low;
    out.itemsNone += items_none;

    out.rfqs.push({
      session_id: r.session_id,
      upload_id: r.upload_id,
      original_filename: r.original_filename,
      customer_name: r.customer_name,
      program_name: r.program_name,
      part_number: r.part_number,
      rfq_reference: r.rfq_reference,
      risk_score: r.risk_score,
      total_items,
      items_with_match,
      items_high,
      items_medium,
      items_low,
      items_none,
      top_match: top,
      created_at: r.created_at,
    });
  }

  return out;
}
