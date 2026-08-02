"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceCompactTable } from "@/components/rfq/reference/ReferenceCompactTable";
import { ReferenceItemCard } from "@/components/rfq/reference/ReferenceItemCard";
import { FilterChip, SummaryTile } from "@/components/rfq/reference/ReferenceMetrics";
import type { CaseData } from "@/data/rfqTypes";
import { computeGapAdjustment } from "@/lib/rfq/gapScoreAdjustment";
import {
  pct,
  referenceScoreBand,
  summarizeReferenceMatches,
  type ItemRow,
  type ScoreBand,
} from "@/lib/rfq/referenceMatchScoring";

/**
 * Scoring lives in `@/lib/rfq/referenceMatchScoring`. These re-exports keep the
 * existing import sites working; new code should import from the lib module.
 */
export {
  MATCH_DIMENSIONS,
  TOTAL_DIMENSIONS,
  dimensionsCovered,
  referenceScoreBand,
  selectTopOverallMatch,
  summarizeReferenceMatches,
  type ReferenceMatchSummary,
  type ScoreBand,
} from "@/lib/rfq/referenceMatchScoring";

export { OverviewTopReferenceCard } from "@/components/rfq/reference/OverviewTopReferenceCard";

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

  const gapAdjustment = useMemo(
    () => computeGapAdjustment(caseData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caseData.gap_findings, caseData.gap_workflow],
  );

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

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by label, part, project ID"
              className="h-8 w-full lg:max-w-sm rounded-md border border-border bg-background px-2 text-[12px]"
            />
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
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
            <ReferenceItemCard key={row.item_index} row={row} caseData={caseData} gapAdjustment={gapAdjustment} />
          ))}
        </div>
      ) : (
        <ReferenceCompactTable rows={filtered} adjustment={gapAdjustment} />
      )}
    </div>
  );
}

