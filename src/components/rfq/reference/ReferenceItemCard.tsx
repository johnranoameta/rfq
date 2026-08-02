"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlternativeReferences } from "@/components/rfq/reference/AlternativeReferences";
import { NoReferenceCard } from "@/components/rfq/reference/NoReferenceCard";
import { CompareLine, Metric } from "@/components/rfq/reference/ReferenceMetrics";
import type { CaseData } from "@/data/rfqTypes";
import { clampDisplayScore } from "@/lib/rfq/gapScoreAdjustment";
import {
  bandCardClasses,
  bandClasses,
  bandLabel,
  coverageBand,
  dimensionsCovered,
  displayRfqIdLocal,
  pct,
  referenceScoreBand,
  reuseRecommendation,
  TOTAL_DIMENSIONS,
  type ItemRow,
} from "@/lib/rfq/referenceMatchScoring";

/** One expandable RFQ line item with its ranked historical matches. */
export function ReferenceItemCard({
  row,
  caseData,
  gapAdjustment,
}: {
  row: ItemRow;
  caseData: CaseData;
  gapAdjustment: number;
}) {
  const top = row.matches[0];
  const alts = row.matches.slice(1, 4);

  if (!top) return <NoReferenceCard row={row} />;

  const score01 = top.similarity_0_1 ?? top.score / 100;
  const rawScorePct = Math.round(score01 * 100);
  const adjustedScorePct = clampDisplayScore(rawScorePct + gapAdjustment);
  const adjustedScore01 = adjustedScorePct / 100;
  const adjustedBand = referenceScoreBand(adjustedScore01);
  const dimsHit = dimensionsCovered(top.reasons);
  const coverage = dimsHit.size / TOTAL_DIMENSIONS;

  return (
    <Card
      className={["border bg-card/45 overflow-hidden", bandCardClasses(adjustedBand)].join(" ")}
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
              bandClasses(adjustedBand),
            ].join(" ")}
            title={
              gapAdjustment > 0
                ? `Raw score: ${rawScorePct}% · +${gapAdjustment} from gap responses`
                : "Reference score"
            }
          >
            <span className="font-mono text-lg font-semibold leading-none">
              {adjustedScorePct}%
            </span>
            <span className="font-mono text-[10px] font-bold leading-none uppercase tracking-wider">
              {bandLabel(adjustedBand)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Reference Score" value={adjustedScorePct + "%"} band={adjustedBand} />
          <Metric label="Coverage" value={pct(coverage)} band={coverageBand(coverage)} />
          <Metric label="Dimensions" value={`${dimsHit.size}/${TOTAL_DIMENSIONS}`} />
        </div>

        <div
          className={[
            "rounded-lg border px-3 py-2 text-[12px]",
            adjustedBand === "high"
              ? "border-border bg-background/30 text-foreground"
              : adjustedBand === "medium"
                ? "border-amber-400/30 bg-amber-400/10 dark:text-amber-200 text-amber-800"
                : "border-red-500/30 bg-red-500/10 dark:text-red-200 text-red-700",
          ].join(" ")}
        >
          <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] mb-0.5 opacity-80">
            Recommendation
          </div>
          <div>{reuseRecommendation(adjustedBand, !!top.exact_part_number)}</div>
        </div>

        {gapAdjustment > 0 ? (
          <div className="text-[11px] font-mono text-muted-foreground">
            +{gapAdjustment} pts from gap responses · Base: {rawScorePct}%
          </div>
        ) : null}

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
              currentValue={caseData.part_number ?? "—"}
              referenceValue={top.record.rfq.part_number}
              mono
            />
            <CompareLine
              label="Material"
              currentValue={caseData.material ?? "—"}
              referenceValue={top.record.rfq.material}
              mono
            />
            <CompareLine
              label="Process"
              currentValue={caseData.process?.[0] ?? "—"}
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

        <AlternativeReferences alts={alts} />
      </CardContent>
    </Card>
  );
}

