import { readFileSync } from "fs";
import path from "path";

import type { HistoricalGapRecord, HistoricalProjectRecord } from "@/lib/rfq/historicalKnowledgeTypes";
import { parseGapCsv } from "@/lib/rfq/historicalKnowledgeParsers";
import { getHistoricalDataDir } from "@/lib/rfq/historicalKnowledgePaths";

import type { Database } from "better-sqlite3";

function projectIdFromRfqId(rfqId: number): string {
  return `H${String(rfqId).padStart(3, "0")}`;
}

type ProjectQuoteRow = {
  rfq_id: number;
  customer: string;
  program_name: string;
  part_name: string;
  part_number: string;
  process_family: string;
  material_grade: string | null;
  thickness_mm: number | null;
  annual_volume: number | null;
  general_tolerance_mm: number | null;
  ppap_level: number | null;
  incoterm: string | null;
  payment_terms: string | null;
  annual_reduction_pct: number | null;
  quoted_piece_price_usd: number | null;
  tooling_cost_usd: number | null;
  packaging_cost_per_pc: number | null;
  award_result: string | null;
};

function expandKbUploadRecordJson(json: string): HistoricalProjectRecord[] {
  try {
    const obj = JSON.parse(json) as unknown;
    if (!obj || typeof obj !== "object") return [];
    const o = obj as Record<string, unknown>;
    const lines = o.kb_line_candidates;
    if (Array.isArray(lines) && lines.length > 0) {
      return lines as HistoricalProjectRecord[];
    }
    const agg = o.aggregate;
    if (agg && typeof agg === "object") {
      return [agg as HistoricalProjectRecord];
    }
    return [obj as HistoricalProjectRecord];
  } catch {
    return [];
  }
}

function rowToRecord(r: ProjectQuoteRow): HistoricalProjectRecord {
  const packaging = Number(r.packaging_cost_per_pc ?? 0);
  return {
    project_id: projectIdFromRfqId(r.rfq_id),
    rfq: {
      customer: r.customer ?? "",
      program: r.program_name ?? "",
      part_name: r.part_name ?? "",
      part_number: r.part_number ?? "",
      process: r.process_family ?? "",
      material: r.material_grade ?? "",
      thickness_mm: Number(r.thickness_mm ?? 0),
      annual_volume: Number(r.annual_volume ?? 0),
      general_tolerance_mm: Number(r.general_tolerance_mm ?? 0),
      ppap_level: Number(r.ppap_level ?? 0),
      incoterm: r.incoterm ?? "",
      payment_terms: r.payment_terms ?? "",
      annual_reduction_pct: Number(r.annual_reduction_pct ?? 0),
    },
    quote_result: {
      packaging_cost_per_pc: packaging,
      quoted_piece_price_usd: Number(r.quoted_piece_price_usd ?? 0),
      tooling_cost_usd: Number(r.tooling_cost_usd ?? 0),
      award_result: String(r.award_result ?? ""),
    },
    notes: "",
  };
}

/**
 * Historical RFQ corpus from relational seed: `rfq_projects` + `customers` + one `quote_submissions` row per RFQ.
 */
export function loadHistoricalProjectsFromDatabase(db: Database): HistoricalProjectRecord[] {
  const rows = db
    .prepare(
      `SELECT
        p.rfq_id,
        c.customer_name AS customer,
        p.program_name,
        p.part_name,
        p.part_number,
        p.process_family,
        p.material_grade,
        p.thickness_mm,
        p.annual_volume,
        p.general_tolerance_mm,
        p.ppap_level,
        p.incoterm,
        p.payment_terms,
        p.annual_reduction_pct,
        q.quoted_piece_price_usd,
        q.tooling_cost_usd,
        q.packaging_cost_per_pc,
        q.award_result
      FROM rfq_projects p
      JOIN customers c ON c.customer_id = p.customer_id
      JOIN quote_submissions q ON q.rfq_id = p.rfq_id
        AND q.submission_id = (
          SELECT MIN(q2.submission_id) FROM quote_submissions q2 WHERE q2.rfq_id = p.rfq_id
        )
      ORDER BY p.rfq_id ASC`,
    )
    .all() as ProjectQuoteRow[];

  const seed = rows.map(rowToRecord);

  let uploaded: HistoricalProjectRecord[] = [];
  try {
    const raw = db
      .prepare(`SELECT record_json FROM kb_uploaded_rfqs ORDER BY datetime(created_at) ASC`)
      .all() as { record_json: string }[];
    uploaded = raw.flatMap((r) => expandKbUploadRecordJson(r.record_json));
  } catch {
    uploaded = [];
  }

  return [...seed, ...uploaded];
}

type GapRow = {
  project_id: string;
  issue_code: string;
  issue_summary: string;
  resolved_in_final_quote: number;
  notes: string | null;
};

export function loadHistoricalGapFindingsFromDatabase(db: Database): HistoricalGapRecord[] {
  const raw = db
    .prepare(
      `SELECT project_id, issue_code, issue_summary, resolved_in_final_quote, notes
       FROM historical_gap_findings
       ORDER BY project_id, issue_code`,
    )
    .all() as GapRow[];
  return raw.map((r) => ({
    project_id: r.project_id,
    issue_code: r.issue_code,
    issue_summary: r.issue_summary,
    resolved_in_final_quote: r.resolved_in_final_quote === 1,
    notes: r.notes ?? "",
  }));
}

/** Seed `historical_gap_findings` from bundled CSV when the table is empty (one-time per DB file). */
export function seedHistoricalGapFindingsFromCsvIfEmpty(db: Database): void {
  const countRow = db.prepare("SELECT COUNT(*) AS n FROM historical_gap_findings").get() as { n: number };
  if (countRow.n > 0) return;

  const csvPath = path.join(getHistoricalDataDir(), "Historical_Gap_Findings.csv");
  let text: string;
  try {
    text = readFileSync(csvPath, "utf-8");
  } catch {
    return;
  }

  const rows = parseGapCsv(text);
  if (rows.length === 0) return;

  const insert = db.prepare(
    `INSERT INTO historical_gap_findings (project_id, issue_code, issue_summary, resolved_in_final_quote, notes)
     VALUES (@project_id, @issue_code, @issue_summary, @resolved_in_final_quote, @notes)`,
  );

  const insertMany = db.transaction((items: HistoricalGapRecord[]) => {
    for (const r of items) {
      insert.run({
        project_id: r.project_id,
        issue_code: r.issue_code,
        issue_summary: r.issue_summary,
        resolved_in_final_quote: r.resolved_in_final_quote ? 1 : 0,
        notes: r.notes,
      });
    }
  });

  insertMany(rows);
}
