import type { CaseData, ItemHistoricalComparison } from "@/data/rfqTypes";

export type ItemRow = NonNullable<CaseData["item_historical_comparison"]>[number];
export type MatchRow = ItemRow["matches"][number];

/**
 * Scoring and banding for the historical reference match.
 *
 * Extracted from `RfqReferenceMatchPanel` so it can be unit-tested: it is pure,
 * has no JSX, and three separate panels plus the coverage matrix depend on it.
 */

/**
 * Dimensions the historical match engine can credit (`rankHistoricalMatches`).
 * Coverage = unique dimensions with at least one matching reason / total.
 */
export const MATCH_DIMENSIONS: Array<{ key: string; label: string; reasonMatchers: string[] }> = [
  { key: "material", label: "Material", reasonMatchers: ["material match"] },
  { key: "program", label: "Program", reasonMatchers: ["program match"] },
  { key: "process", label: "Process", reasonMatchers: ["process match"] },
  { key: "customer", label: "Customer", reasonMatchers: ["customer overlap"] },
  {
    key: "partName",
    label: "Part name",
    reasonMatchers: [
      "part name overlap",
      "high part-name similarity",
      "moderate part-name similarity",
    ],
  },
  { key: "exactPN", label: "Exact P/N", reasonMatchers: ["exact part number match"] },
  {
    key: "spec",
    label: "Specs",
    reasonMatchers: ["spec similarity", "partial spec similarity"],
  },
  {
    key: "feature",
    label: "Features",
    reasonMatchers: ["feature similarity", "partial feature similarity"],
  },
  {
    key: "thickness",
    label: "Thickness",
    reasonMatchers: ["thickness match", "thickness close"],
  },
  {
    key: "volume",
    label: "Volume",
    reasonMatchers: ["similar annual volume", "related volume band"],
  },
];

export const TOTAL_DIMENSIONS = MATCH_DIMENSIONS.length;

export type ScoreBand = "high" | "medium" | "low";

/** HIGH ≥0.80, MEDIUM 0.60–0.79, LOW <0.60 (per Reference Engine v5 doc). */
export function referenceScoreBand(score01: number): ScoreBand {
  if (score01 >= 0.8) return "high";
  if (score01 >= 0.6) return "medium";
  return "low";
}

export function bandLabel(b: ScoreBand): string {
  if (b === "high") return "HIGH";
  if (b === "medium") return "MEDIUM";
  return "LOW";
}

export function bandClasses(b: ScoreBand): string {
  if (b === "high") {
    return "border-border bg-background/30 text-foreground";
  }
  if (b === "medium") {
    return "border-amber-400/40 bg-amber-400/10 dark:text-amber-200 text-amber-800";
  }
  return "border-red-500/40 bg-red-500/15 dark:text-red-200 text-red-700";
}

/** Card border/ring treatment for an item card, keyed on its adjusted band. */
export function bandCardClasses(b: ScoreBand): string {
  if (b === "high") return "border-emerald-400/40 ring-1 ring-emerald-400/20";
  if (b === "medium") return "border-amber-400/40";
  return "border-red-500/40";
}

export function reuseRecommendation(b: ScoreBand, exactPn: boolean): string {
  if (exactPn) return "Exact part number — reuse historical pricing/tooling baseline.";
  if (b === "high") return "Reuse with minimal adjustment — strong reference.";
  if (b === "medium") return "Partial reference — review key gaps before reuse.";
  return "Weak reference — proceed with caution; treat as new quote.";
}

/** Reasons are matched case-insensitively against each dimension's phrases. */
export function dimensionsCovered(reasons: string[]): Set<string> {
  const hit = new Set<string>();
  const lower = reasons.map((r) => r.toLowerCase());
  for (const dim of MATCH_DIMENSIONS) {
    if (dim.reasonMatchers.some((m) => lower.includes(m))) {
      hit.add(dim.key);
    }
  }
  return hit;
}

export function matchCoverage01(reasons: string[]): number {
  return dimensionsCovered(reasons).size / TOTAL_DIMENSIONS;
}

/** Coverage bands are wider than score bands: HIGH ≥0.50, MEDIUM 0.30–0.49. */
export function coverageBand(c: number): ScoreBand {
  if (c >= 0.5) return "high";
  if (c >= 0.3) return "medium";
  return "low";
}

/** Seed rows are stored as `H001`; the UI shows the full historical RFQ id. */
export function displayRfqIdLocal(id: string): string {
  const m = id.match(/^H(\d+)$/i);
  if (!m) return id;
  return `RFQ-SEAT-HIST-${m[1]!.padStart(3, "0")}`;
}

export function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Picks the single best item-match pair across the whole RFQ (highest score). */
export function selectTopOverallMatch(
  rows: ItemHistoricalComparison[] | undefined,
): { item: ItemRow; match: MatchRow } | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let best: { item: ItemRow; match: MatchRow } | null = null;
  for (const item of rows) {
    const m = item.matches[0];
    if (!m) continue;
    if (!best || m.score > best.match.score) {
      best = { item, match: m };
    }
  }
  return best;
}

export type ReferenceMatchSummary = {
  totalItems: number;
  itemsWithMatch: number;
  itemsHigh: number;
  itemsMedium: number;
  itemsLow: number;
  itemsNoMatch: number;
};

/** Bands each item by its top match; items with no match are counted separately. */
export function summarizeReferenceMatches(
  rows: ItemHistoricalComparison[] | undefined,
): ReferenceMatchSummary {
  const out: ReferenceMatchSummary = {
    totalItems: 0,
    itemsWithMatch: 0,
    itemsHigh: 0,
    itemsMedium: 0,
    itemsLow: 0,
    itemsNoMatch: 0,
  };
  if (!Array.isArray(rows)) return out;
  out.totalItems = rows.length;
  for (const r of rows) {
    const top = r.matches[0];
    if (!top) {
      out.itemsNoMatch += 1;
      continue;
    }
    out.itemsWithMatch += 1;
    const band = referenceScoreBand(top.similarity_0_1 ?? top.score / 100);
    if (band === "high") out.itemsHigh += 1;
    else if (band === "medium") out.itemsMedium += 1;
    else out.itemsLow += 1;
  }
  return out;
}
