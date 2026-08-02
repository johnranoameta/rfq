"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseData, ItemHistoricalComparison } from "@/data/rfqTypes";
import { clampDisplayScore, computeGapAdjustment } from "@/lib/rfq/gapScoreAdjustment";
import {
  bandClasses,
  bandLabel,
  displayRfqIdLocal,
  matchCoverage01,
  pct,
  referenceScoreBand,
  reuseRecommendation,
  selectTopOverallMatch,
  summarizeReferenceMatches,
} from "@/lib/rfq/referenceMatchScoring";

/** Compact "best reference across the whole RFQ" card used on Overview and Reuse. */
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
  const adjustment = useMemo(
    () => computeGapAdjustment(caseData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caseData.gap_findings, caseData.gap_workflow],
  );

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
  const rawScorePct = Math.round(score01 * 100);
  const adjustedScorePct = clampDisplayScore(rawScorePct + adjustment);
  const adjustedBand = referenceScoreBand(adjustedScorePct / 100);
  const coverage = matchCoverage01(top.match.reasons);

  return (
    <Card
      className={[
        "border bg-card/45 overflow-hidden",
        adjustedBand === "high"
          ? "border-emerald-400/40"
          : adjustedBand === "medium"
            ? "border-amber-400/40"
            : "border-red-500/40",
      ].join(" ")}
    >
      <CardContent className="p-4 flex items-stretch gap-4 flex-wrap">
        <div
          className={[
            "shrink-0 w-[140px] rounded-xl border px-3 py-3 text-center",
            bandClasses(adjustedBand),
          ].join(" ")}
        >
          <div className="text-[9px] font-mono font-semibold uppercase tracking-[0.12em] opacity-80">
            Reference Score
          </div>
          <div className="mt-1 font-mono text-3xl font-semibold leading-none">
            {adjustedScorePct}%
          </div>
          <div className="mt-1 text-[10px] font-mono font-bold uppercase tracking-wider">
            {bandLabel(adjustedBand)}
          </div>
          {adjustment > 0 ? (
            <div className="mt-1 text-[9px] font-mono opacity-70">
              Base {rawScorePct}% +{adjustment}
            </div>
          ) : null}
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
            {reuseRecommendation(adjustedBand, !!top.match.exact_part_number)}
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

