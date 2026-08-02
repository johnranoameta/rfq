"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisHistoricalSection } from "@/components/rfq/upload/AnalysisHistoricalSection";
import type { FullAnalyzeOk } from "@/components/rfq/upload/uploadTypes";

/** Gap-analysis findings and the ranked historical matches for one analysis run. */
export function AnalysisGapSection({ data: ps_data }: { data: FullAnalyzeOk }) {
  const ps = { data: ps_data } as const;
  return (
    <>
<Card className="bg-background/30 border-border">
  <CardHeader className="p-3 pb-1">
    <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">
      Gap analysis
    </CardTitle>
  </CardHeader>
  <CardContent className="p-3 pt-0 space-y-2 text-[11px]">
    <div className="flex flex-wrap gap-3">
      <span className="font-semibold">Risk {ps.data.gap.risk_score}</span>
      {typeof ps.data.gap.risk_score_0_1 === "number" ? (
        <span className="text-muted-foreground font-mono">
          ({ps.data.gap.risk_score_0_1.toFixed(2)} normalized)
        </span>
      ) : null}
      <span className="text-muted-foreground">
        Completeness: {ps.data.gap.completeness_status}
      </span>
      {ps.data.gap.gap_model ? (
        <span className="text-muted-foreground font-mono text-[10px]">{ps.data.gap.gap_model}</span>
      ) : null}
    </div>
    <p className="text-muted-foreground leading-relaxed">{ps.data.gap.summary}</p>
    {ps.data.gap.item_gaps && ps.data.gap.item_gaps.length > 0 ? (
      <div className="rounded-md border border-border/80 p-2 bg-muted/15">
        <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
          Item-level gaps (model)
        </div>
        <ul className="space-y-2 text-[10px]">
          {ps.data.gap.item_gaps.map((ig) => (
            <li key={ig.item}>
              <span className="font-semibold">{ig.item}</span>
              <ul className="list-disc pl-4 mt-0.5">
                {ig.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    ) : null}
    {ps.data.gap.missing_attachments.length ? (
      <div>
        <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
          Missing / unresolved
        </div>
        <ul className="list-disc pl-4 space-y-0.5 font-mono text-[10px]">
          {ps.data.gap.missing_attachments.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    ) : null}
    {ps.data.gap.triggered_rules.length ? (
      <div className="font-mono text-[10px]">
        Rules: {ps.data.gap.triggered_rules.join(", ")}
      </div>
    ) : null}
    <ul className="list-decimal pl-4 space-y-1 text-muted-foreground">
      {ps.data.gap.recommended_actions.map((a, i) => (
        <li key={i}>{a}</li>
      ))}
    </ul>
    {ps.data.gap.historical_issues.length ? (
      <div className="rounded-md border border-border/80 p-2 bg-muted/15">
        <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
          Historical issues (matched projects)
        </div>
        <ul className="space-y-1 text-[10px]">
          {ps.data.gap.historical_issues.map((h) => (
            <li key={`${h.project_id}-${h.issue_code}`}>
              <span className="font-mono">{h.project_id}</span> {h.issue_summary}{" "}
              <span className="text-muted-foreground">({h.notes})</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null}
  </CardContent>
</Card>

<AnalysisHistoricalSection data={ps.data} />
    </>
  );
}
