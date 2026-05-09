"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CaseData, ItemHistoricalComparison } from "@/data/rfqTypes";

type ItemRow = NonNullable<CaseData["item_historical_comparison"]>[number];
type MatchRow = ItemRow["matches"][number];

/**
 * Dimensions the historical match engine can credit (`rankHistoricalMatches`).
 * Used to compute Coverage = unique dimensions with at least one matching reason / total.
 */
const MATCH_DIMENSIONS: Array<{ key: string; label: string; reasonMatchers: string[] }> = [
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

const TOTAL_DIMENSIONS = MATCH_DIMENSIONS.length;

export type ScoreBand = "high" | "medium" | "low";

/** HIGH ≥0.80, MEDIUM 0.60–0.79, LOW <0.60 (per Reference Engine v5 doc). */
export function referenceScoreBand(score01: number): ScoreBand {
  if (score01 >= 0.8) return "high";
  if (score01 >= 0.6) return "medium";
  return "low";
}

function bandLabel(b: ScoreBand): string {
  if (b === "high") return "HIGH";
  if (b === "medium") return "MEDIUM";
  return "LOW";
}

function bandClasses(b: ScoreBand): string {
  if (b === "high") {
    return "border-emerald-400/40 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700";
  }
  if (b === "medium") {
    return "border-amber-400/40 bg-amber-400/10 dark:text-amber-200 text-amber-800";
  }
  return "border-red-500/40 bg-red-500/15 dark:text-red-200 text-red-700";
}

function reuseRecommendation(b: ScoreBand, exactPn: boolean): string {
  if (exactPn) return "Exact part number — reuse historical pricing/tooling baseline.";
  if (b === "high") return "Reuse with minimal adjustment — strong reference.";
  if (b === "medium") return "Partial reference — review key gaps before reuse.";
  return "Weak reference — proceed with caution; treat as new quote.";
}

function dimensionsCovered(reasons: string[]): Set<string> {
  const hit = new Set<string>();
  const lower = reasons.map((r) => r.toLowerCase());
  for (const dim of MATCH_DIMENSIONS) {
    if (dim.reasonMatchers.some((m) => lower.includes(m))) {
      hit.add(dim.key);
    }
  }
  return hit;
}

function matchCoverage01(reasons: string[]): number {
  return dimensionsCovered(reasons).size / TOTAL_DIMENSIONS;
}

function displayRfqIdLocal(id: string): string {
  const m = id.match(/^H(\d+)$/i);
  if (!m) return id;
  return `RFQ-SEAT-HIST-${m[1]!.padStart(3, "0")}`;
}

function pct(n: number): string {
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

type ViewMode = "cards" | "table";

type RfqReferenceMatchPanelProps = {
  caseData: CaseData;
};

export function RfqReferenceMatchPanel({ caseData }: RfqReferenceMatchPanelProps) {
  const rows = useMemo<ItemRow[]>(
    () => caseData.item_historical_comparison ?? [],
    [caseData.item_historical_comparison],
  );
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [bandFilter, setBandFilter] = useState<"all" | ScoreBand | "none">("all");

  const summary = useMemo(() => summarizeReferenceMatches(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const tokens = [
          row.item_label,
          row.part_name ?? "",
          row.matches[0]?.project_id ?? "",
          row.matches[0]?.record.rfq.part_name ?? "",
          row.matches[0]?.record.rfq.part_number ?? "",
        ];
        if (!tokens.some((t) => t.toLowerCase().includes(q))) return false;
      }
      if (bandFilter !== "all") {
        const top = row.matches[0];
        if (bandFilter === "none") return !top;
        if (!top) return false;
        const b = referenceScoreBand(top.similarity_0_1 ?? top.score / 100);
        return b === bandFilter;
      }
      return true;
    });
  }, [rows, search, bandFilter]);

  if (rows.length === 0) {
    return (
      <Card className="bg-card/45 border-border">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No historical comparison data available for this RFQ.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card/45 border-border overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border bg-secondary/15">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
                Historical Reference Match — {summary.totalItems} items
              </CardTitle>
              <p className="mt-2 text-[12px] text-muted-foreground max-w-xl">
                Top historical RFQs ranked per line item. Reuse strong matches to accelerate
                pricing and engineering decisions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={[
                    "h-8 px-3 text-[11px] font-mono",
                    viewMode === "cards"
                      ? "bg-accent/15 text-accent dark:text-accent/90"
                      : "bg-background/20 text-muted-foreground hover:bg-background/30",
                  ].join(" ")}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={[
                    "h-8 px-3 text-[11px] font-mono border-l border-border",
                    viewMode === "table"
                      ? "bg-accent/15 text-accent dark:text-accent/90"
                      : "bg-background/20 text-muted-foreground hover:bg-background/30",
                  ].join(" ")}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryTile
              label="Strong (HIGH)"
              value={`${summary.itemsHigh}`}
              hint={summary.itemsWithMatch ? `${pct(summary.itemsHigh / summary.totalItems)} of items` : "—"}
              tone="good"
            />
            <SummaryTile
              label="Partial (MEDIUM)"
              value={`${summary.itemsMedium}`}
              hint={summary.itemsWithMatch ? `${pct(summary.itemsMedium / summary.totalItems)} of items` : "—"}
              tone="warn"
            />
            <SummaryTile
              label="Weak (LOW)"
              value={`${summary.itemsLow}`}
              hint={summary.itemsWithMatch ? `${pct(summary.itemsLow / summary.totalItems)} of items` : "—"}
              tone="bad"
            />
            <SummaryTile
              label="No reference"
              value={`${summary.itemsNoMatch}`}
              hint="Treat as new quote"
              tone="neutral"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by label, part, project ID"
              className="h-8 flex-1 min-w-[220px] rounded-md border border-border bg-background px-2 text-[12px]"
            />
            <FilterChip active={bandFilter === "all"} onClick={() => setBandFilter("all")}>
              All ({summary.totalItems})
            </FilterChip>
            {summary.itemsHigh > 0 ? (
              <FilterChip
                active={bandFilter === "high"}
                onClick={() => setBandFilter("high")}
                tone="good"
              >
                High ({summary.itemsHigh})
              </FilterChip>
            ) : null}
            {summary.itemsMedium > 0 ? (
              <FilterChip
                active={bandFilter === "medium"}
                onClick={() => setBandFilter("medium")}
                tone="warn"
              >
                Medium ({summary.itemsMedium})
              </FilterChip>
            ) : null}
            {summary.itemsLow > 0 ? (
              <FilterChip
                active={bandFilter === "low"}
                onClick={() => setBandFilter("low")}
                tone="bad"
              >
                Low ({summary.itemsLow})
              </FilterChip>
            ) : null}
            {summary.itemsNoMatch > 0 ? (
              <FilterChip
                active={bandFilter === "none"}
                onClick={() => setBandFilter("none")}
              >
                No match ({summary.itemsNoMatch})
              </FilterChip>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="bg-card/45 border-border">
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No items match the current filter.
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((row) => (
            <ReferenceItemCard key={row.item_index} row={row} caseData={caseData} />
          ))}
        </div>
      ) : (
        <CompactTable rows={filtered} />
      )}
    </div>
  );
}

function ReferenceItemCard({ row, caseData }: { row: ItemRow; caseData: CaseData }) {
  const top = row.matches[0];
  const alts = row.matches.slice(1, 4);

  if (!top) {
    return (
      <Card className="bg-card/40 border-border">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] text-muted-foreground">{row.item_label}</div>
              <div className="text-sm font-semibold mt-0.5">{row.part_name || "—"}</div>
            </div>
            <Badge
              variant="outline"
              className="border-border text-muted-foreground text-[10px] font-mono uppercase"
            >
              No reference
            </Badge>
          </div>
          <p className="text-[12px] text-muted-foreground">
            No historical RFQ matched. Treat this line as a new quote.
          </p>
        </CardContent>
      </Card>
    );
  }

  const score01 = top.similarity_0_1 ?? top.score / 100;
  const band = referenceScoreBand(score01);
  const dimsHit = dimensionsCovered(top.reasons);
  const coverage = dimsHit.size / TOTAL_DIMENSIONS;

  return (
    <Card
      className={[
        "border bg-card/45 overflow-hidden",
        band === "high"
          ? "border-emerald-400/40 ring-1 ring-emerald-400/20"
          : band === "medium"
            ? "border-amber-400/40"
            : "border-red-500/40",
      ].join(" ")}
    >
      <CardHeader className="p-4 pb-3 border-b border-border bg-secondary/10">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Item {row.item_label}
              </span>
              {top.exact_part_number ? (
                <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wide text-accent dark:text-accent/90">
                  Exact P/N
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-sm font-semibold truncate" title={row.part_name || ""}>
              {row.part_name || "—"}
            </div>
          </div>

          <div
            className={[
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5",
              bandClasses(band),
            ].join(" ")}
            title="Reference score"
          >
            <span className="font-mono text-lg font-semibold leading-none">
              {score01.toFixed(2)}
            </span>
            <span className="font-mono text-[10px] font-bold leading-none uppercase tracking-wider">
              {bandLabel(band)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Reference Score" value={score01.toFixed(2)} band={band} />
          <Metric label="Coverage" value={pct(coverage)} band={coverageBand(coverage)} />
          <Metric label="Dimensions" value={`${dimsHit.size}/${TOTAL_DIMENSIONS}`} />
        </div>

        <div
          className={[
            "rounded-lg border px-3 py-2 text-[12px]",
            band === "high"
              ? "border-emerald-400/30 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700"
              : band === "medium"
                ? "border-amber-400/30 bg-amber-400/10 dark:text-amber-200 text-amber-800"
                : "border-red-500/30 bg-red-500/10 dark:text-red-200 text-red-700",
          ].join(" ")}
        >
          <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] mb-0.5 opacity-80">
            Recommendation
          </div>
          <div>{reuseRecommendation(band, !!top.exact_part_number)}</div>
        </div>

        <div className="rounded-lg border border-border bg-background/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Best historical reference
              </div>
              <div className="mt-1 font-mono text-[12px] font-semibold text-accent dark:text-accent/90">
                {displayRfqIdLocal(top.project_id)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                Quoted
              </div>
              <div className="mt-1 font-mono text-[12px] font-semibold">
                {top.record.quote_result?.quoted_piece_price_usd != null
                  ? `$${top.record.quote_result.quoted_piece_price_usd.toFixed(2)}/pc`
                  : "—"}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <CompareLine
              label="Part name"
              currentValue={row.part_name || "—"}
              referenceValue={top.record.rfq.part_name || "—"}
            />
            <CompareLine
              label="Part number"
              currentValue={caseData.part_number}
              referenceValue={top.record.rfq.part_number}
              mono
            />
            <CompareLine
              label="Material"
              currentValue={caseData.material}
              referenceValue={top.record.rfq.material}
              mono
            />
            <CompareLine
              label="Process"
              currentValue={caseData.process[0] ?? "—"}
              referenceValue={top.record.rfq.process}
            />
          </div>
        </div>

        {top.reasons.length > 0 ? (
          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
              Why matched
            </div>
            <div className="flex flex-wrap gap-1.5">
              {top.reasons.map((r, i) => (
                <span
                  key={`${r}-${i}`}
                  className="inline-flex items-center rounded-full border border-accent/30 bg-accent/8 px-2 py-0.5 text-[10px] font-mono text-accent dark:text-accent/90"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {alts.length > 0 ? (
          <details className="group">
            <summary className="cursor-pointer text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <span className="group-open:hidden">▸</span>
              <span className="hidden group-open:inline">▾</span>
              Alternative references ({alts.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {alts.map((m) => {
                const altScore01 = m.similarity_0_1 ?? m.score / 100;
                const altBand = referenceScoreBand(altScore01);
                return (
                  <div
                    key={m.project_id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/20 px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {displayRfqIdLocal(m.project_id)}
                      </div>
                      <div
                        className="text-[11px] truncate"
                        title={`${m.record.rfq.part_name} · ${m.record.rfq.material}`}
                      >
                        {m.record.rfq.part_name} · {m.record.rfq.material}
                      </div>
                    </div>
                    <span
                      className={[
                        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase",
                        bandClasses(altBand),
                      ].join(" ")}
                    >
                      {altScore01.toFixed(2)} · {bandLabel(altBand)}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function coverageBand(c: number): ScoreBand {
  if (c >= 0.5) return "high";
  if (c >= 0.3) return "medium";
  return "low";
}

function Metric({
  label,
  value,
  band,
}: {
  label: string;
  value: string;
  band?: ScoreBand;
}) {
  const cls = band ? bandClasses(band) : "border-border bg-background/25 text-foreground";
  return (
    <div className={["rounded-lg border px-2.5 py-2", cls].join(" ")}>
      <div className="text-[9px] font-mono font-semibold uppercase tracking-[0.12em] opacity-80">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold leading-tight">{value}</div>
    </div>
  );
}

function CompareLine({
  label,
  currentValue,
  referenceValue,
  mono,
}: {
  label: string;
  currentValue: string;
  referenceValue: string;
  mono?: boolean;
}) {
  const same = currentValue.trim().toLowerCase() === referenceValue.trim().toLowerCase();
  const valueCls = mono ? "font-mono text-[11px]" : "text-[11px]";
  return (
    <div className="rounded border border-border/60 bg-background/30 px-2 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] font-mono uppercase text-muted-foreground/80 w-7 shrink-0">
            New
          </span>
          <span className={[valueCls, "truncate"].join(" ")} title={currentValue}>
            {currentValue}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] font-mono uppercase text-muted-foreground/80 w-7 shrink-0">
            Hist
          </span>
          <span
            className={[
              valueCls,
              "truncate",
              same
                ? "dark:text-emerald-200 text-emerald-700"
                : "dark:text-amber-200 text-amber-800",
            ].join(" ")}
            title={referenceValue}
          >
            {referenceValue}
            {same ? " ✓" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "good" | "warn" | "bad";
}) {
  const toneCls = !tone
    ? active
      ? "border-accent/50 bg-card text-accent dark:text-accent/90"
      : "border-border bg-background/20 text-muted-foreground hover:bg-background/30"
    : tone === "good"
      ? active
        ? "border-emerald-400/50 bg-emerald-400/15 dark:text-emerald-200 text-emerald-700"
        : "border-emerald-400/30 bg-emerald-400/8 dark:text-emerald-200/90 text-emerald-700/90 hover:bg-emerald-400/15"
      : tone === "warn"
        ? active
          ? "border-amber-400/50 bg-amber-400/15 dark:text-amber-200 text-amber-800"
          : "border-amber-400/30 bg-amber-400/8 dark:text-amber-200/90 text-amber-800/90 hover:bg-amber-400/15"
        : active
          ? "border-red-500/50 bg-red-500/15 dark:text-red-200 text-red-700"
          : "border-red-500/30 bg-red-500/8 dark:text-red-200/90 text-red-700/90 hover:bg-red-500/15";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-8 px-3 rounded-lg border font-mono text-[11px] transition",
        toneCls,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-400/35 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700"
      : tone === "warn"
        ? "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800"
        : tone === "bad"
          ? "border-red-500/35 bg-red-500/10 dark:text-red-200 text-red-700"
          : "border-border bg-background/25 text-muted-foreground";
  return (
    <div className={["rounded-xl border px-3 py-2.5", cls].join(" ")}>
      <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] opacity-80">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-mono opacity-75">{hint}</div>
    </div>
  );
}

function CompactTable({ rows }: { rows: ItemRow[] }) {
  return (
    <Card className="bg-card/50 border-border overflow-visible">
      <CardContent className="p-0 overflow-x-auto">
        <Table className="text-[11px] min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Top historical</TableHead>
              <TableHead>Matched RFQs</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Coverage</TableHead>
              <TableHead>Band</TableHead>
              <TableHead>Exact P/N</TableHead>
              <TableHead className="text-right">Matches</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const top = row.matches[0];
              const matchedIds = row.matches.slice(0, 3).map((m) => displayRfqIdLocal(m.project_id));
              const score01 = top ? (top.similarity_0_1 ?? top.score / 100) : 0;
              const band = top ? referenceScoreBand(score01) : null;
              const cov = top ? matchCoverage01(top.reasons) : 0;
              return (
                <TableRow key={`${row.item_index}-${row.item_label}`}>
                  <TableCell className="font-mono">{row.item_label}</TableCell>
                  <TableCell
                    className="max-w-[260px] whitespace-normal break-words"
                    title={row.part_name || "—"}
                  >
                    {row.part_name || "—"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {top?.project_id ? displayRfqIdLocal(top.project_id) : "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-[300px] whitespace-normal break-all font-mono"
                    title={matchedIds.join(", ")}
                  >
                    {matchedIds.length > 0 ? matchedIds.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {top ? score01.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{top ? pct(cov) : "—"}</TableCell>
                  <TableCell>
                    {band ? (
                      <Badge
                        variant="outline"
                        className={["border font-mono text-[10px] uppercase", bandClasses(band)].join(" ")}
                      >
                        {bandLabel(band)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{top?.exact_part_number ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right font-mono">{row.matches.length}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type OverviewTopReferenceCardProps = {
  caseData: CaseData;
  onOpenMatches: () => void;
};

/**
 * Compact "Top Historical Reference" surface for the Overview tab.
 * Shows the single best item-level historical match across the RFQ.
 */
export function OverviewTopReferenceCard({
  caseData,
  onOpenMatches,
}: OverviewTopReferenceCardProps) {
  const rows = useMemo<ItemHistoricalComparison[]>(
    () => caseData.item_historical_comparison ?? [],
    [caseData.item_historical_comparison],
  );
  const top = useMemo(() => selectTopOverallMatch(rows), [rows]);
  const summary = useMemo(() => summarizeReferenceMatches(rows), [rows]);

  if (!top) {
    if (rows.length === 0) return null;
    return (
      <Card className="bg-card/45 border-border">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Top Historical Reference
            </div>
            <div className="mt-1 text-sm">
              No historical RFQ matched any line item. Treat this RFQ as a new quote.
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onOpenMatches}>
            Open Match &amp; Reuse
          </Button>
        </CardContent>
      </Card>
    );
  }

  const score01 = top.match.similarity_0_1 ?? top.match.score / 100;
  const band = referenceScoreBand(score01);
  const coverage = matchCoverage01(top.match.reasons);

  return (
    <Card
      className={[
        "border bg-card/45 overflow-hidden",
        band === "high"
          ? "border-emerald-400/40"
          : band === "medium"
            ? "border-amber-400/40"
            : "border-red-500/40",
      ].join(" ")}
    >
      <CardContent className="p-4 flex items-stretch gap-4 flex-wrap">
        <div
          className={[
            "shrink-0 w-[140px] rounded-xl border px-3 py-3 text-center",
            bandClasses(band),
          ].join(" ")}
        >
          <div className="text-[9px] font-mono font-semibold uppercase tracking-[0.12em] opacity-80">
            Reference Score
          </div>
          <div className="mt-1 font-mono text-3xl font-semibold leading-none">
            {score01.toFixed(2)}
          </div>
          <div className="mt-1 text-[10px] font-mono font-bold uppercase tracking-wider">
            {bandLabel(band)}
          </div>
        </div>

        <div className="flex-1 min-w-[240px] space-y-1">
          <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Top Historical Reference — Item {top.item.item_label}
          </div>
          <div className="text-sm font-semibold">{top.item.part_name || "—"}</div>
          <div className="font-mono text-[12px] text-accent dark:text-accent/90">
            matches {displayRfqIdLocal(top.match.project_id)} —{" "}
            {top.match.record.rfq.part_name}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {reuseRecommendation(band, !!top.match.exact_part_number)}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground">
            <span>Coverage {pct(coverage)}</span>
            <span>·</span>
            <span>
              {summary.itemsHigh} HIGH / {summary.itemsMedium} MED / {summary.itemsLow} LOW
              {summary.itemsNoMatch ? ` / ${summary.itemsNoMatch} none` : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center">
          <Button size="sm" variant="outline" onClick={onOpenMatches}>
            View all matches
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
