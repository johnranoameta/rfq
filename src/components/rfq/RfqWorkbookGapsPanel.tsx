"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseData, GapFinding, GapWorkflowStatus } from "@/data/rfqTypes";
import { gapFindingUploadSlot } from "@/lib/rfq/reconcileGapsWithDocuments";

type GapFilterKey =
  | "all"
  | "sev-critical"
  | "sev-high"
  | "sev-medium"
  | "sev-low"
  | `cat-${string}`;

function isGapWorkflowClosed(w: GapWorkflowStatus | undefined): boolean {
  return w === "resolved" || w === "accepted_risk";
}

function gapRuleSupplySlotLegacy(c: CaseData, rule: string): string | null {
  if (rule === "RULE_001") {
    const d = c.docs.find((x) => x.type === "pkg" && x.status === "miss");
    return d?.name ?? null;
  }
  if (rule === "RULE_002" || rule === "RULE_028") {
    const d = c.docs.find((x) => x.type === "test" && (x.status === "miss" || x.status === "pend"));
    return d?.name ?? null;
  }
  if (rule === "RULE_029") {
    const d = c.docs.find((x) => x.type === "comm" && x.status === "ok");
    return d?.name ?? null;
  }
  return null;
}

function filterButtonCls(active: boolean) {
  return [
    "h-8 px-3 rounded-xl border font-mono text-[11px] transition",
    active ? "border-accent/60 bg-card" : "border-border bg-background/20 hover:bg-background/30",
  ].join(" ");
}

function SeverityPill({
  sev,
  count,
  active,
  onClick,
}: {
  sev: "critical" | "high" | "medium" | "low";
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const cls =
    sev === "critical"
      ? "border-red-500/40 bg-red-500/10 dark:text-red-200 text-red-700"
      : sev === "high"
        ? "border-orange-500/40 bg-orange-500/10 dark:text-orange-200 text-orange-700"
        : sev === "medium"
          ? "border-amber-400/40 bg-amber-400/10 dark:text-amber-200 text-amber-800"
          : "border-cyan-500/40 bg-cyan-500/10 dark:text-cyan-200 text-cyan-800";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 px-3 rounded-xl border font-mono text-[11px] transition inline-flex items-center gap-2",
        active ? "border-accent/60 bg-card ring-1 ring-accent/30" : cls,
      ].join(" ")}
    >
      {sev.toUpperCase()} ({count})
    </button>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" }) {
  const cls =
    tone === "good"
      ? "dark:text-emerald-200 text-emerald-700 border-emerald-400/30 bg-emerald-400/10"
      : tone === "warn"
        ? "dark:text-amber-200 text-amber-800 border-amber-400/30 bg-amber-400/10"
        : "text-muted-foreground border-border bg-background/20";
  return (
    <div className={["rounded-xl border p-2", cls].join(" ")}>
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-[12px] font-semibold">{value}</div>
    </div>
  );
}

export type RfqWorkbookGapsPanelProps = {
  caseData: CaseData;
  gapFilter: GapFilterKey;
  setGapFilter: (value: GapFilterKey) => void;
  expandedRule: Record<string, boolean>;
  toggleExpanded: (rule: string) => void;
  gapFindingsFiltered: GapFinding[];
  catOptions: string[];
  supplyDocError: string | null;
  supplyDocBusySlot: string | null;
  onSupplyMissingDoc: (slotName: string, file: File) => void;
  onWorkflowChange: (rule: string, status: GapWorkflowStatus) => void;
  onOpenDocuments?: () => void;
};

export function RfqWorkbookGapsPanel({
  caseData,
  gapFilter,
  setGapFilter,
  expandedRule,
  toggleExpanded,
  gapFindingsFiltered,
  catOptions,
  supplyDocError,
  supplyDocBusySlot,
  onSupplyMissingDoc,
  onWorkflowChange,
  onOpenDocuments,
}: RfqWorkbookGapsPanelProps) {
  const supplyInputBaseId = useId();
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
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
          Gap Analysis
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[12px] text-muted-foreground font-mono">
            {caseData.gap_findings.filter((f) => !isGapWorkflowClosed(caseData.gap_workflow?.[f.rule])).length} open ·{" "}
            {caseData.gap_findings.length} total
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 text-[11px]" onClick={() => onOpenDocuments?.()}>
            Documents & upload
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <SeverityPill
          sev="critical"
          count={
            caseData.gap_findings.filter(
              (f) => f.sev === "critical" && !isGapWorkflowClosed(caseData.gap_workflow?.[f.rule]),
            ).length
          }
          active={gapFilter === "sev-critical"}
          onClick={() => setGapFilter("sev-critical")}
        />
        <SeverityPill
          sev="high"
          count={
            caseData.gap_findings.filter((f) => f.sev === "high" && !isGapWorkflowClosed(caseData.gap_workflow?.[f.rule]))
              .length
          }
          active={gapFilter === "sev-high"}
          onClick={() => setGapFilter("sev-high")}
        />
        <SeverityPill
          sev="medium"
          count={
            caseData.gap_findings.filter(
              (f) => f.sev === "medium" && !isGapWorkflowClosed(caseData.gap_workflow?.[f.rule]),
            ).length
          }
          active={gapFilter === "sev-medium"}
          onClick={() => setGapFilter("sev-medium")}
        />
        <SeverityPill
          sev="low"
          count={
            caseData.gap_findings.filter((f) => f.sev === "low" && !isGapWorkflowClosed(caseData.gap_workflow?.[f.rule]))
              .length
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
              ? "border-accent/60 bg-card"
              : "border-border bg-background/20 hover:bg-background/30",
          ].join(" ")}
        >
          All ({caseData.gap_findings.length})
        </button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">
          Filter:
        </div>
        <button
          type="button"
          onClick={() => setGapFilter("all")}
          className={filterButtonCls(gapFilter === "all")}
        >
          All ({caseData.gap_findings.length})
        </button>
        {caseData.gap_findings.some((f) => f.sev === "high") ? (
          <button
            type="button"
            onClick={() => setGapFilter("sev-high")}
            className={filterButtonCls(gapFilter === "sev-high")}
          >
            High (
            {
              caseData.gap_findings.filter(
                (f) => f.sev === "high" && !isGapWorkflowClosed(caseData.gap_workflow?.[f.rule]),
              ).length
            }
            )
          </button>
        ) : null}
        {caseData.gap_findings.some((f) => f.sev === "medium") ? (
          <button
            type="button"
            onClick={() => setGapFilter("sev-medium")}
            className={filterButtonCls(gapFilter === "sev-medium")}
          >
            Medium (
            {
              caseData.gap_findings.filter(
                (f) => f.sev === "medium" && !isGapWorkflowClosed(caseData.gap_workflow?.[f.rule]),
              ).length
            }
            )
          </button>
        ) : null}
        {caseData.gap_findings.some((f) => f.sev === "low") ? (
          <button
            type="button"
            onClick={() => setGapFilter("sev-low")}
            className={filterButtonCls(gapFilter === "sev-low")}
          >
            Low (
            {
              caseData.gap_findings.filter(
                (f) => f.sev === "low" && !isGapWorkflowClosed(caseData.gap_workflow?.[f.rule]),
              ).length
            }
            )
          </button>
        ) : null}

        {catOptions.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setGapFilter(`cat-${cat}`)}
            className={filterButtonCls(gapFilter === `cat-${cat}`)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {gapFindingsFiltered.length === 0 ? (
          <div className="text-muted-foreground text-[12px]">
            No findings match this filter.
          </div>
        ) : (
          gapFindingsFiltered.map((f) => {
            const expanded = !!expandedRule[f.rule];
            const wf = caseData.gap_workflow?.[f.rule] ?? "open";
            const closed = isGapWorkflowClosed(wf);
            const supplySlot = gapFindingUploadSlot(caseData, f) ?? gapRuleSupplySlotLegacy(caseData, f.rule);
            const supplySlotDoc = supplySlot ? caseData.docs.find((d) => d.name === supplySlot) : undefined;
            const supplyLabel =
              supplySlotDoc?.status === "ok" ? "Replace" : supplySlot ? "Upload" : null;

            const sevColor =
              f.sev === "critical"
                ? "bg-red-500"
                : f.sev === "high"
                  ? "bg-orange-500"
                  : f.sev === "medium"
                    ? "bg-amber-400"
                    : "bg-cyan-400";

            const sevPill =
              f.sev === "critical"
                ? "dark:text-red-200 text-red-700 border-red-500/30 bg-red-500/10"
                : f.sev === "high"
                  ? "dark:text-orange-200 text-orange-700 border-orange-500/30 bg-orange-500/10"
                  : f.sev === "medium"
                    ? "dark:text-amber-200 text-amber-800 border-amber-400/35 bg-amber-400/10"
                    : "dark:text-cyan-200 text-cyan-800 border-cyan-500/30 bg-cyan-500/10";

            return (
              <div
                key={f.rule}
                className={[
                  "rounded-xl border border-border/70 bg-card/25 transition-all shadow-sm",
                  expanded
                    ? "ring-1 ring-accent/60"
                    : "hover:bg-card/35 hover:border-accent/30",
                  closed ? "opacity-75 border-emerald-500/20 bg-emerald-500/[0.03]" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(f.rule)}
                  className="w-full text-left focus-visible:outline-none"
                >
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-[minmax(0,180px)_1fr_minmax(0,320px)] items-start gap-3">
                    <div className="flex items-start gap-3">
                      <div className={["mt-2 w-2.5 h-2.5 rounded-full shadow-sm", sevColor].join(" ")} />
                      <div className="font-mono text-[10px] text-muted-foreground border border-border bg-background/20 rounded-md px-2 py-0.5 whitespace-nowrap">
                        {f.rule}
                      </div>
                      {f.doc_slot ? (
                        <div
                          className="font-mono text-[9px] text-muted-foreground/80 mt-1 max-w-[160px] truncate"
                          title={f.doc_slot}
                        >
                          Doc: {f.doc_slot}
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-[13px] truncate" title={f.title}>
                        {f.title}
                      </div>
                      <div
                        className="mt-1 text-[11px] font-mono text-muted-foreground truncate"
                        title={`${f.cat} · ${f.impact}`}
                      >
                        Category :{" "}
                        <span className="text-accent dark:text-accent/90 font-semibold">
                          {f.cat}
                        </span>{" "}
                        <span
                          className={[
                            "inline-flex items-center rounded-md border px-2 py-0.5 ml-1",
                            "text-[11px] font-mono",
                            "bg-background/20 dark:bg-background/15",
                            "border-border/70",
                            "text-muted-foreground",
                          ].join(" ")}
                        >
                          · {f.impact}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {supplySlot && supplyLabel ? (
                        <>
                          <input
                            id={`${supplyInputBaseId}-gap-${f.rule.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                            type="file"
                            className="sr-only"
                            accept=".xlsx,.xls"
                            disabled={supplyDocBusySlot !== null}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (file) void onSupplyMissingDoc(supplySlot, file);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-[11px]"
                            disabled={supplyDocBusySlot !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              const el = document.getElementById(
                                `${supplyInputBaseId}-gap-${f.rule.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
                              ) as HTMLInputElement | null;
                              el?.click();
                            }}
                          >
                            {supplyDocBusySlot === supplySlot ? "Uploading…" : supplyLabel}
                          </Button>
                        </>
                      ) : null}
                      <div
                        className={[
                          "rounded-lg border px-2 py-1 text-[11px] font-mono",
                          "leading-none h-8 flex items-center",
                          sevPill,
                        ].join(" ")}
                      >
                        {f.sev.toUpperCase()}
                      </div>
                      <select
                        className="h-8 rounded-lg border border-border bg-background/25 px-2 text-[11px] font-mono text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background max-w-[140px]"
                        value={wf}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          const v = e.target.value as GapWorkflowStatus;
                          onWorkflowChange(f.rule, v);
                        }}
                      >
                        <option value="open">Open</option>
                        <option value="in_review">In Review</option>
                        <option value="resolved">Resolved</option>
                        <option value="accepted_risk">Accepted Risk</option>
                      </select>
                    </div>
                  </div>
                </button>

                {expanded ? (
                  <div className="px-5 pb-5 pt-2">
                    <div className="rounded-xl border border-border bg-background/20 p-4">
                      <div className="text-[13px] text-muted-foreground leading-relaxed">{f.detail}</div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border bg-background/25 p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
                          Evidence
                        </div>
                        <div className="text-[12px] text-muted-foreground leading-relaxed">{f.evidence}</div>
                      </div>
                      <div className="rounded-xl border border-border bg-background/25 p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
                          Recommended Action
                        </div>
                        <div className="text-[12px] text-muted-foreground leading-relaxed">{f.action}</div>
                      </div>
                    </div>

                    {f.hist ? (
                      <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] dark:text-blue-200 text-blue-700 font-mono mb-2">
                          Historical Benchmark
                        </div>
                        <div className="text-[12px] text-muted-foreground">
                          {f.hist.projects.join(", ")} · {f.hist.label}
                        </div>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <MiniStat label={f.hist.label} value={f.hist.hist_val} tone="good" />
                          <MiniStat label="This RFQ" value={f.hist.curr_val} tone="warn" />
                          <MiniStat label="Projects Matched" value={`${f.hist.projects.length}`} tone="neutral" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </CardContent>
  </Card>
</div>
  );
}
