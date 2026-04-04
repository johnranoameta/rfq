import { readFile } from "fs/promises";
import path from "path";

import type {
  HistoricalGapRecord,
  HistoricalKnowledgeBundle,
  HistoricalProjectRecord,
} from "@/lib/rfq/historicalKnowledgeTypes";
import { getHistoricalDataDir } from "@/lib/rfq/historicalKnowledgePaths";

let cache: HistoricalKnowledgeBundle | null = null;
let cacheError: string | null = null;

function parseGapCsv(text: string): HistoricalGapRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rows: HistoricalGapRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^([^,]+),([^,]+),([^,]+),([^,]+),(.*)$/);
    if (!m) continue;
    const resolved = m[4].trim();
    rows.push({
      project_id: m[1].trim(),
      issue_code: m[2].trim(),
      issue_summary: m[3].trim(),
      resolved_in_final_quote: resolved === "1" || resolved.toLowerCase() === "true",
      notes: m[5].trim(),
    });
  }
  return rows;
}

function parseJsonl(text: string): HistoricalProjectRecord[] {
  const out: HistoricalProjectRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as HistoricalProjectRecord);
    } catch {
      /* skip bad line */
    }
  }
  return out;
}

export async function loadHistoricalKnowledge(): Promise<HistoricalKnowledgeBundle> {
  if (cache) return cache;
  if (cacheError) {
    throw new Error(cacheError);
  }

  const dir = getHistoricalDataDir();
  const jsonlPath = path.join(dir, "Parsed_Historical_RFQs.jsonl");
  const csvPath = path.join(dir, "Historical_Gap_Findings.csv");

  try {
    const [jsonlRaw, csvRaw] = await Promise.all([
      readFile(jsonlPath, "utf-8"),
      readFile(csvPath, "utf-8"),
    ]);
    cache = {
      sourceDir: dir,
      projects: parseJsonl(jsonlRaw),
      gapFindings: parseGapCsv(csvRaw),
    };
    return cache;
  } catch (e) {
    cacheError =
      e instanceof Error
        ? e.message
        : "Failed to read historical_data files (check project_files path).";
    throw new Error(cacheError);
  }
}

export function clearHistoricalKnowledgeCache(): void {
  cache = null;
  cacheError = null;
}

export function normalizeProgramLabel(p: string): string {
  return p
    .trim()
    .replace(/^NB-/i, "")
    .trim()
    .toLowerCase();
}

export type MatchCriteria = {
  material?: string | null;
  program?: string | null;
  process?: string | null;
  customer?: string | null;
  part_name?: string | null;
  annual_volume?: number | null;
};

export type RankedHistoricalMatch = {
  project_id: string;
  score: number;
  reasons: string[];
  record: HistoricalProjectRecord;
};

/**
 * Lightweight similarity ranking for agents (not ML). Tune or replace later.
 */
export function rankHistoricalMatches(
  criteria: MatchCriteria,
  projects: HistoricalProjectRecord[],
  limit = 8,
): RankedHistoricalMatch[] {
  const mat = criteria.material?.trim().toLowerCase() ?? "";
  const prog = criteria.program ? normalizeProgramLabel(criteria.program) : "";
  const proc = criteria.process?.trim().toLowerCase() ?? "";
  const cust = criteria.customer?.trim().toLowerCase() ?? "";
  const part = criteria.part_name?.trim().toLowerCase() ?? "";
  const vol = criteria.annual_volume;

  const scored = projects.map((record) => {
    let score = 0;
    const reasons: string[] = [];
    const r = record.rfq;

    if (mat && r.material.toLowerCase() === mat) {
      score += 4;
      reasons.push("material match");
    }
    if (prog && normalizeProgramLabel(r.program) === prog) {
      score += 3;
      reasons.push("program match");
    }
    if (proc && r.process.toLowerCase() === proc) {
      score += 2;
      reasons.push("process match");
    }
    if (cust && r.customer.toLowerCase().includes(cust)) {
      score += 1;
      reasons.push("customer overlap");
    }
    if (part && r.part_name.toLowerCase().includes(part)) {
      score += 2;
      reasons.push("part name overlap");
    }
    if (typeof vol === "number" && vol > 0 && r.annual_volume > 0) {
      const ratio = Math.max(vol, r.annual_volume) / Math.min(vol, r.annual_volume);
      if (ratio <= 1.35) {
        score += 2;
        reasons.push("similar annual volume");
      } else if (ratio <= 2) {
        score += 1;
        reasons.push("related volume band");
      }
    }

    return { project_id: record.project_id, score, reasons, record };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.project_id.localeCompare(b.project_id))
    .slice(0, limit);
}
