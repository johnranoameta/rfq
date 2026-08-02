"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseData, GapFinding, GapWorkflowStatus } from "@/data/rfqTypes";
import { isGapFinalized, isGapOpenInCase } from "@/lib/rfq/reconcileGapsWithDocuments";
import {
  computeCostExposure,
  parseImpactDollars,
  riskTone,
} from "@/lib/rfq/gapCostExposure";
import { GapFindingRow } from "@/components/rfq/gaps/GapFindingRow";
import { catDeptLabel, SeverityPill } from "@/components/rfq/gaps/GapStatusUi";

type GapFilterKey =
  | "all"
  | "finalized"
  | "sev-critical"
  | "sev-high"
  | "sev-medium"
  | "sev-low"
  | `cat-${string}`;

type SortKey = "severity" | "cost" | "status";

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const WF_ORDER: Record<string, number> = { open: 0, in_review: 1, resolved: 2, accepted_risk: 3 };




export type RfqWorkbookGapsPanelProps = {
  caseData: CaseData;
  gapFilter: GapFilterKey;
  setGapFilter: (value: GapFilterKey) => void;
  gapFindingsFiltered: GapFinding[];
  supplyDocError: string | null;
  supplyDocBusySlot: string | null;
  onSupplyMissingDoc: (slotName: string, file: File) => void;
  onRemoveSuppliedDoc: (slotName: string, rule: string) => void;
  onFinalizeGapDoc: (slotName: string, rule: string) => void;
  onWorkflowChange: (rule: string, status: GapWorkflowStatus) => void;
  onOpenDocuments?: () => void;
};

export function RfqWorkbookGapsPanel({
  caseData,
  gapFilter,
  setGapFilter,
  gapFindingsFiltered,
  supplyDocError,
  supplyDocBusySlot,
  onSupplyMissingDoc,
  onRemoveSuppliedDoc,
  onFinalizeGapDoc,
  onWorkflowChange,
  onOpenDocuments,
}: RfqWorkbookGapsPanelProps) {
  const supplyInputBaseId = useId();
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("severity");
  const [search, setSearch] = useState("");
  const openGapCount = caseData.gap_findings.filter((f) => isGapOpenInCase(caseData, f)).length;
  const finalizedFindings = caseData.gap_findings.filter((f) => isGapFinalized(caseData, f));
  const visibleFindings = caseData.gap_findings.filter((f) => !isGapFinalized(caseData, f));
  const finalizedGapCount = finalizedFindings.length;
  // Department count badges follow the active mode: finalized set under "Finalized", otherwise the visible set.
  const deptCountBase = gapFilter === "finalized" ? finalizedFindings : visibleFindings;
  // If the selected department has no cards in the active mode, fall back to "all" so the user
  // is never stranded in an empty grid with no visible pill to clear (e.g. after switching to Finalized).
  const effectiveDeptFilter =
    deptFilter === "all" || deptCountBase.some((f) => f.cat === deptFilter) ? deptFilter : "all";
  const costExposure = computeCostExposure(caseData.gap_findings, caseData.gap_workflow);
  const activeKbLabel = caseData.kb_category_label?.trim() || null;

  const riskCls =
    riskTone(caseData.risk_score) === "good"
      ? "border-emerald-400/40 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700"
      : riskTone(caseData.risk_score) === "warn"
        ? "border-amber-400/40 bg-amber-400/10 dark:text-amber-200 text-amber-800"
        : "border-orange-500/40 bg-orange-500/10 dark:text-orange-200 text-orange-700";

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 border-border">
        <CardContent className="p-5 space-y-4">
            {supplyDocError ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
              >
                {supplyDocError}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                  Gap Analysis
                </div>
                {activeKbLabel ? (
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    Active RFQ · <span className="text-foreground font-medium">{activeKbLabel}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className={["rounded-lg border px-2.5 py-1 text-[11px] font-mono font-semibold", riskCls].join(" ")}
                >
                  Risk {caseData.risk_score}
                  {caseData.risk_score < 35 ? " · Good" : caseData.risk_score < 55 ? " · Improving" : " · Review"}
                </div>
                {(costExposure.perPc || costExposure.nre) ? (
                  <div className="rounded-lg border border-orange-500/30 bg-orange-500/8 px-2.5 py-1 text-[11px] font-mono dark:text-orange-200 text-orange-700">
                    {[
                      costExposure.perPc
                        ? costExposure.perPc[0] === costExposure.perPc[1]
                          ? `$${costExposure.perPc[0].toFixed(2)}/pc`
                          : `$${costExposure.perPc[0].toFixed(2)}–${costExposure.perPc[1].toFixed(2)}/pc`
                        : null,
                      costExposure.nre
                        ? costExposure.nre[0] === costExposure.nre[1]
                          ? `$${(costExposure.nre[0] / 1000).toFixed(0)}K NRE`
                          : `$${(costExposure.nre[0] / 1000).toFixed(0)}K–${(costExposure.nre[1] / 1000).toFixed(0)}K NRE`
                        : null,
                    ].filter(Boolean).join(" · ")} exposure
                  </div>
                ) : null}
                <div className="text-[12px] text-muted-foreground font-mono">
                  {openGapCount} open · {visibleFindings.length} total
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px]"
                  onClick={() => onOpenDocuments?.()}
                >
                  Documents & upload
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/15 p-3 space-y-3">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Severity</div>
              <div className="flex gap-2 flex-wrap">
                <SeverityPill
                  sev="critical"
                  count={
                    caseData.gap_findings.filter(
                      (f) => f.sev === "critical" && isGapOpenInCase(caseData, f),
                    ).length
                  }
                  active={gapFilter === "sev-critical"}
                  onClick={() => setGapFilter("sev-critical")}
                />
                <SeverityPill
                  sev="high"
                  count={
                    caseData.gap_findings.filter((f) => f.sev === "high" && isGapOpenInCase(caseData, f)).length
                  }
                  active={gapFilter === "sev-high"}
                  onClick={() => setGapFilter("sev-high")}
                />
                <SeverityPill
                  sev="medium"
                  count={
                    caseData.gap_findings.filter(
                      (f) => f.sev === "medium" && isGapOpenInCase(caseData, f),
                    ).length
                  }
                  active={gapFilter === "sev-medium"}
                  onClick={() => setGapFilter("sev-medium")}
                />
                <SeverityPill
                  sev="low"
                  count={
                    caseData.gap_findings.filter((f) => f.sev === "low" && isGapOpenInCase(caseData, f)).length
                  }
                  active={gapFilter === "sev-low"}
                  onClick={() => setGapFilter("sev-low")}
                />
                <button
                  type="button"
                  onClick={() => setGapFilter("all")}
                  className={[
                    "h-9 px-3 rounded-xl border font-mono text-[11px] transition",
                    gapFilter === "all"
                      ? "border-accent/60 bg-card ring-1 ring-accent/30"
                      : "border-border bg-background/20 hover:bg-background/30",
                  ].join(" ")}
                >
                  All ({caseData.gap_findings.length - finalizedGapCount})
                </button>
                {finalizedGapCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setGapFilter("finalized")}
                    className={[
                      "h-9 px-3 rounded-xl border font-mono text-[11px] transition",
                      gapFilter === "finalized"
                        ? "border-accent/60 bg-card ring-1 ring-accent/30"
                        : "border-border bg-background/20 hover:bg-background/30",
                    ].join(" ")}
                  >
                    Finalized ({finalizedGapCount})
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/15 p-3 space-y-3">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Department</div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "commercial", "technical", "completeness", "quality", "logistics", "quote"] as const).map((cat) => {
                  const count = cat === "all"
                    ? deptCountBase.length
                    : deptCountBase.filter((f) => f.cat === cat).length;
                  if (cat !== "all" && count === 0) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDeptFilter(cat)}
                      className={[
                        "h-9 px-3 rounded-xl border font-mono text-[11px] transition",
                        effectiveDeptFilter === cat
                          ? "border-accent/60 bg-card ring-1 ring-accent/30"
                          : "border-border bg-background/20 hover:bg-background/30",
                      ].join(" ")}
                    >
                      {cat === "all" ? `All (${count})` : `${catDeptLabel(cat)} (${count})`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="search"
                placeholder="Search gaps…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 flex-1 min-w-[160px] rounded-lg border border-border bg-background/20 px-3 text-[12px] placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Sort</span>
                {(["severity", "cost", "status"] as SortKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSortBy(key)}
                    className={[
                      "h-7 px-2.5 rounded-lg border font-mono text-[10px] transition capitalize",
                      sortBy === key
                        ? "border-accent/60 bg-card ring-1 ring-accent/30 text-foreground"
                        : "border-border bg-background/20 text-muted-foreground hover:bg-background/30",
                    ].join(" ")}
                  >
                    {key === "cost" ? "Cost impact" : key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {(() => {
                const q = search.trim().toLowerCase();
                const visible = gapFindingsFiltered
                  .filter((f) => effectiveDeptFilter === "all" || f.cat === effectiveDeptFilter)
                  .filter((f) =>
                    !q ||
                    f.title.toLowerCase().includes(q) ||
                    f.detail.toLowerCase().includes(q) ||
                    f.evidence.toLowerCase().includes(q) ||
                    f.action.toLowerCase().includes(q) ||
                    f.rule.toLowerCase().includes(q),
                  )
                  .slice()
                  .sort((a, b) => {
                    if (sortBy === "severity") return (SEV_ORDER[a.sev] ?? 9) - (SEV_ORDER[b.sev] ?? 9);
                    if (sortBy === "status") {
                      const wa = caseData.gap_workflow?.[a.rule] ?? "open";
                      const wb = caseData.gap_workflow?.[b.rule] ?? "open";
                      return (WF_ORDER[wa] ?? 0) - (WF_ORDER[wb] ?? 0);
                    }
                    if (sortBy === "cost") {
                      const pa = parseImpactDollars(a.impact);
                      const pb = parseImpactDollars(b.impact);
                      const aVal = pa.perPc ? pa.perPc[1] * 1000 : pa.nre ? pa.nre[1] : -1;
                      const bVal = pb.perPc ? pb.perPc[1] * 1000 : pb.nre ? pb.nre[1] : -1;
                      return bVal - aVal;
                    }
                    return 0;
                  });
                if (visible.length === 0) {
                  return <div className="text-muted-foreground text-[12px]">{q ? "No findings match your search." : "No findings match this filter."}</div>;
                }
                return visible.map((f) => (
                  <GapFindingRow
                    key={f.rule}
                    f={f}
                    caseData={caseData}
                    supplyDocBusySlot={supplyDocBusySlot}
                    supplyInputBaseId={supplyInputBaseId}
                    onSupplyMissingDoc={onSupplyMissingDoc}
                    onRemoveSuppliedDoc={onRemoveSuppliedDoc}
                    onFinalizeGapDoc={onFinalizeGapDoc}
                    onWorkflowChange={onWorkflowChange}
                  />
                ));
              })()}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
