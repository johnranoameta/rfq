import { readFile } from "fs/promises";
import path from "path";

import { parseGapCsv, parseHistoricalJsonl } from "@/lib/rfq/historicalKnowledgeParsers";
import type {
  HistoricalGapRecord,
  HistoricalKnowledgeBundle,
  HistoricalProjectRecord,
} from "@/lib/rfq/historicalKnowledgeTypes";
import { getHistoricalDataDir } from "@/lib/rfq/historicalKnowledgePaths";
import { getMatchScoringConfig } from "@/lib/rfq/matchScoringConfig";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";
import {
  loadHistoricalGapFindingsFromDatabase,
  loadHistoricalProjectsFromDatabase,
  seedHistoricalGapFindingsFromCsvIfEmpty,
} from "@/lib/rfq/sqlite/historicalKnowledgeDb";

let cache: HistoricalKnowledgeBundle | null = null;
let cacheError: string | null = null;

/**
 * Loads the historical RFQ knowledge base: **primary** source is SQLite (`rfq_projects` + `quote_submissions`
 * and `historical_gap_findings`), with fallback to `Parsed_Historical_RFQs.jsonl` and `Historical_Gap_Findings.csv`
 * in `project_files/.../historical_data/` if the database is empty or unavailable.
 */
export async function loadHistoricalKnowledge(): Promise<HistoricalKnowledgeBundle> {
  if (cache) return cache;
  if (cacheError) {
    throw new Error(cacheError);
  }

  const dir = getHistoricalDataDir();
  const jsonlPath = path.join(dir, "Parsed_Historical_RFQs.jsonl");
  const csvPath = path.join(dir, "Historical_Gap_Findings.csv");

  let projects: HistoricalProjectRecord[] = [];
  let projectsSource: "sqlite" | "jsonl" = "jsonl";
  let gapFindings: HistoricalGapRecord[] = [];
  let gapSource: "sqlite" | "csv" = "csv";

  let sqliteFailed = false;
  try {
    const db = getRfqDb();
    seedHistoricalGapFindingsFromCsvIfEmpty(db);
    const fromDb = loadHistoricalProjectsFromDatabase(db);
    if (fromDb.length > 0) {
      projects = fromDb;
      projectsSource = "sqlite";
    }
    const fromGaps = loadHistoricalGapFindingsFromDatabase(db);
    if (fromGaps.length > 0) {
      gapFindings = fromGaps;
      gapSource = "sqlite";
    }
  } catch {
    sqliteFailed = true;
  }

  if (projects.length === 0) {
    try {
      const jsonlRaw = await readFile(jsonlPath, "utf-8");
      projects = parseHistoricalJsonl(jsonlRaw);
      projectsSource = "jsonl";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to read historical JSONL";
      cacheError = sqliteFailed ? `SQLite unavailable or empty; JSONL failed: ${msg}` : msg;
      throw new Error(cacheError);
    }
  }

  if (gapFindings.length === 0) {
    try {
      const csvRaw = await readFile(csvPath, "utf-8");
      gapFindings = parseGapCsv(csvRaw);
      gapSource = "csv";
    } catch (e) {
      if (projects.length > 0) {
        gapFindings = [];
        gapSource = projectsSource === "sqlite" ? "sqlite" : "csv";
      } else {
        const msg = e instanceof Error ? e.message : "Failed to read historical CSV";
        throw new Error(msg);
      }
    }
  }

  cache = { sourceDir: dir, projects, gapFindings, projectsSource, gapSource };
  return cache;
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
  part_number?: string | null;
  annual_volume?: number | null;
  thickness_mm?: number | null;
  specs_text?: string | null;
  feature_text?: string | null;
};

export type RankedHistoricalMatch = {
  project_id: string;
  score: number;
  similarity_0_1: number;
  exact_part_number: boolean;
  reasons: string[];
  record: HistoricalProjectRecord;
};

function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normText(s).split(" ").filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * Lightweight similarity ranking for agents (not ML). Tune or replace later.
 */
export function rankHistoricalMatches(
  criteria: MatchCriteria,
  projects: HistoricalProjectRecord[],
  limit = 8,
): RankedHistoricalMatch[] {
  const cfg = getMatchScoringConfig();
  const w = cfg.weights;
  const t = cfg.thresholds;
  const mat = criteria.material?.trim().toLowerCase() ?? "";
  const prog = criteria.program ? normalizeProgramLabel(criteria.program) : "";
  const proc = criteria.process?.trim().toLowerCase() ?? "";
  const cust = criteria.customer?.trim().toLowerCase() ?? "";
  const part = criteria.part_name?.trim().toLowerCase() ?? "";
  const partNumber = criteria.part_number?.trim().toLowerCase() ?? "";
  const vol = criteria.annual_volume;
  const thick = criteria.thickness_mm;
  const specTokens = tokenSet(criteria.specs_text ?? "");
  const featureTokens = tokenSet(criteria.feature_text ?? "");
  const partTokens = tokenSet(criteria.part_name ?? "");

  const scored = projects.map((record) => {
    let score = 0; // 0..100 weighted score
    const reasons: string[] = [];
    const r = record.rfq;
    const rPartNumber = r.part_number.trim().toLowerCase();
    const exactPartNumber = partNumber.length > 0 && rPartNumber === partNumber;

    if (mat && r.material.toLowerCase() === mat) {
      score += w.materialExact;
      reasons.push("material match");
    }
    if (prog && normalizeProgramLabel(r.program) === prog) {
      score += w.programExact;
      reasons.push("program match");
    }
    if (proc && r.process.toLowerCase() === proc) {
      score += w.processExact;
      reasons.push("process match");
    }
    if (cust && r.customer.toLowerCase().includes(cust)) {
      score += w.customerOverlap;
      reasons.push("customer overlap");
    }
    if (part && r.part_name.toLowerCase().includes(part)) {
      score += w.partNameSubstring;
      reasons.push("part name overlap");
    }
    if (exactPartNumber) {
      score += w.exactPartNumber;
      reasons.push("exact part number match");
    }

    const rPartTokens = tokenSet(r.part_name);
    const nameSim = jaccard(partTokens, rPartTokens);
    if (nameSim >= t.partNameSimilarityHigh) {
      score += w.partNameSimilarityHigh;
      reasons.push("high part-name similarity");
    } else if (nameSim >= t.partNameSimilarityMedium) {
      score += w.partNameSimilarityMedium;
      reasons.push("moderate part-name similarity");
    }

    const specCorpus = `${r.part_name} ${r.material} ${r.process} ${record.notes}`;
    const specSim = jaccard(specTokens, tokenSet(specCorpus));
    if (specSim >= t.specSimilarityHigh) {
      score += w.specSimilarityHigh;
      reasons.push("spec similarity");
    } else if (specSim >= t.specSimilarityMedium) {
      score += w.specSimilarityMedium;
      reasons.push("partial spec similarity");
    }

    const featSim = jaccard(featureTokens, tokenSet(specCorpus));
    if (featSim >= t.featureSimilarityHigh) {
      score += w.featureSimilarityHigh;
      reasons.push("feature similarity");
    } else if (featSim >= t.featureSimilarityMedium) {
      score += w.featureSimilarityMedium;
      reasons.push("partial feature similarity");
    }

    if (typeof thick === "number" && thick > 0 && r.thickness_mm > 0) {
      const tr = Math.max(thick, r.thickness_mm) / Math.min(thick, r.thickness_mm);
      if (tr <= t.thicknessMatchRatio) {
        score += w.thicknessMatch;
        reasons.push("thickness match");
      } else if (tr <= t.thicknessCloseRatio) {
        score += w.thicknessClose;
        reasons.push("thickness close");
      }
    }

    if (typeof vol === "number" && vol > 0 && r.annual_volume > 0) {
      const ratio = Math.max(vol, r.annual_volume) / Math.min(vol, r.annual_volume);
      if (ratio <= t.volumeSimilarRatio) {
        score += w.volumeSimilar;
        reasons.push("similar annual volume");
      } else if (ratio <= t.volumeRelatedRatio) {
        score += w.volumeRelated;
        reasons.push("related volume band");
      }
    }

    const clamped = Math.max(0, Math.min(100, score));
    return {
      project_id: record.project_id,
      score: clamped,
      similarity_0_1: clamped / 100,
      exact_part_number: exactPartNumber,
      reasons,
      record,
    };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.project_id.localeCompare(b.project_id))
    .slice(0, limit);
}
