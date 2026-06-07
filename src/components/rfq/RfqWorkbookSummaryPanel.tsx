"use client";

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseData, GapWorkflowStatus } from "@/data/rfqTypes";
import { OverviewTopReferenceCard } from "@/components/rfq/RfqReferenceMatchPanel";

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

function isGapWorkflowClosed(w: GapWorkflowStatus | undefined): boolean {
  return w === "resolved" || w === "accepted_risk";
}

function riskBucket(score: number) {
  if (score >= 80) return "crit" as const;
  if (score >= 60) return "high" as const;
  if (score >= 40) return "med" as const;
  return "low" as const;
}

function riskLabel(score: number) {
  const b = riskBucket(score);
  if (b === "crit") return "Critical";
  if (b === "high") return "High";
  if (b === "med") return "Medium";
  return "Low";
}

function riskBadgeClasses(score: number) {
  const b = riskBucket(score);
  if (b === "crit") {
    return "border-red-500/40 bg-red-500/15 dark:text-red-200 text-red-700";
  }
  if (b === "high") {
    return "border-orange-500/40 bg-orange-500/15 dark:text-orange-200 text-orange-700";
  }
  if (b === "med") {
    return "border-amber-400/40 bg-amber-400/15 dark:text-amber-200 text-amber-800";
  }
  return "border-emerald-400/40 bg-emerald-400/15 dark:text-emerald-200 text-emerald-700";
}

function Stat({
  label,
  value,
  mono,
  tone = "default",
  pill,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "accent" | "destructive" | "warn";
  pill?: boolean;
}) {
  const toneCls =
    tone === "destructive"
      ? "dark:text-red-200 text-red-700"
      : tone === "accent"
        ? "text-accent dark:text-accent/90"
        : tone === "warn"
          ? "dark:text-amber-200 text-amber-800"
          : "text-foreground";

  const pillCls =
    tone === "destructive"
      ? "border-red-500/35 bg-red-500/10 dark:bg-red-500/10"
      : tone === "accent"
        ? "border-accent/35 bg-accent/8 dark:bg-accent/6"
        : tone === "warn"
          ? "border-amber-400/35 bg-amber-400/10 dark:bg-amber-400/8"
          : "border-border bg-background/20";

  return (
    <div>
      <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground font-mono">
        {label}
      </div>
      {pill ? (
        <div
          className={[
            "mt-1 inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-semibold",
            mono ? "font-mono" : "font-sans",
            pillCls,
            toneCls,
          ].join(" ")}
        >
          {value}
        </div>
      ) : (
        <div className={["mt-1 text-sm", mono ? "font-mono" : "font-sans", toneCls].join(" ")}>{value}</div>
      )}
    </div>
  );
}

export type RfqWorkbookSummaryPanelProps = {
  caseData: CaseData;
  sessionNotice?: string | null;
  onOpenMatches?: () => void;
};

export function RfqWorkbookSummaryPanel({
  caseData: c,
  sessionNotice,
  onOpenMatches,
}: RfqWorkbookSummaryPanelProps) {
  const docMissingCount = c.docs.filter((d) => d.status === "miss").length;
  const totalDocCount = c.docs.length;
  const missingDocPct =
    totalDocCount > 0 ? clampPct(((totalDocCount - docMissingCount) / totalDocCount) * 100) : 0;
  const parsedDocCount = totalDocCount - docMissingCount;
  const completenessPctRounded = Math.round(missingDocPct);
  const completenessTone = missingDocPct >= 85 ? "good" : missingDocPct >= 60 ? "warn" : "bad";

  const openFindings = c.gap_findings.filter((f) => !isGapWorkflowClosed(c.gap_workflow?.[f.rule]));
  const openHighGaps = openFindings.filter((f) => f.sev === "high").length;
  const openMedGaps = openFindings.filter((f) => f.sev === "medium").length;
  const openCritGaps = openFindings.filter((f) => f.sev === "critical").length;
  const openLowGaps = openFindings.filter((f) => f.sev === "low").length;

  const rulesTriggered = c.triggered_rules.length;
  const rulesTriggeredPct = Math.round((rulesTriggered / 28) * 100);

  const notes = useMemo(() => {
    const items: { title: string; body: string; severity: "low" | "medium" | "high" | "critical" }[] = [];
    for (const g of openFindings.slice(0, 6)) {
      items.push({
        title: g.title,
        body: g.action || g.detail,
        severity: g.sev,
      });
    }
    if (items.length === 0) {
      items.push({
        title: "No open gaps",
        body: "All current findings are resolved or accepted.",
        severity: "low",
      });
    }
    return items;
  }, [openFindings]);

  const paymentDays = Number(c.payment.split(" ")[1]);

  return (
    <div className="space-y-4">
      {sessionNotice ? (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-amber-900 dark:text-amber-200"
          role="status"
        >
          {sessionNotice}
        </div>
      ) : null}

      <OverviewTopReferenceCard caseData={c} onOpenMatches={onOpenMatches ?? (() => {})} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-background/25 dark:bg-card/40 border-border">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                Completeness
              </div>
              <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                {parsedDocCount} / {c.docs.length}
              </div>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="font-mono text-3xl font-semibold">{completenessPctRounded}%</div>
              <div className="text-[10px] font-mono font-semibold tracking-wider">
                {completenessTone === "good"
                  ? "Solid"
                  : completenessTone === "warn"
                    ? "Needs Review"
                    : "Incomplete"}
              </div>
            </div>
            <div className="h-2 bg-background/40 dark:bg-card/20 border border-border rounded-full overflow-hidden">
              <div
                className={[
                  "h-full rounded-full",
                  completenessTone === "good"
                    ? "bg-emerald-400"
                    : completenessTone === "warn"
                      ? "bg-amber-400"
                      : "bg-red-500",
                ].join(" ")}
                style={{ width: `${missingDocPct}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              {docMissingCount ? (
                <>
                  {docMissingCount} missing ·{" "}
                  <span
                    className={
                      completenessTone === "good"
                        ? "text-emerald-700 dark:text-emerald-200"
                        : completenessTone === "warn"
                          ? "text-amber-800 dark:text-amber-200"
                          : "text-red-700 dark:text-red-200"
                    }
                  >
                    fill required
                  </span>
                </>
              ) : (
                "All referenced documents received"
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/25 dark:bg-card/40 border-border">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                Open Findings
              </div>
              <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                {openFindings.length} open · {c.gap_findings.length} total
              </div>
            </div>
            <div className="font-mono text-3xl font-semibold">{openFindings.length}</div>
            <div className="flex flex-wrap gap-2">
              {openCritGaps ? (
                <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-mono text-red-700 dark:text-red-200">
                  {openCritGaps} critical
                </span>
              ) : null}
              {openHighGaps ? (
                <span className="inline-flex items-center rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-mono text-orange-700 dark:text-orange-200">
                  {openHighGaps} high
                </span>
              ) : null}
              {openMedGaps ? (
                <span className="inline-flex items-center rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-mono text-amber-800 dark:text-amber-200">
                  {openMedGaps} medium
                </span>
              ) : null}
              {openLowGaps ? (
                <span className="inline-flex items-center rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-mono text-emerald-700 dark:text-emerald-200">
                  {openLowGaps} low
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/25 dark:bg-card/40 border-border">
          <CardContent className="p-5 space-y-3">
            <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
              Risk Score
            </div>
            <div className="flex items-center justify-between gap-3">
              <div
                className={[
                  "inline-flex items-center gap-2 rounded-md border px-3 py-1 bg-background/30",
                  riskBadgeClasses(c.risk_score),
                ].join(" ")}
              >
                <span className="font-mono text-2xl font-semibold">{c.risk_score}</span>
                <span className="font-mono text-xs font-semibold text-muted-foreground">/100</span>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              <span className="font-semibold">{riskLabel(c.risk_score)}</span> —{" "}
              {c.risk_score >= 80
                ? "Management review required"
                : c.risk_score >= 60
                  ? "Elevated — gaps to resolve"
                  : "Low — minor items only"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-background/25 dark:bg-card/40 border-border">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                Rules Triggered
              </div>
              <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                {rulesTriggeredPct}% of catalog
              </div>
            </div>
            <div className="font-mono text-3xl font-semibold text-accent dark:text-accent/90">{rulesTriggered}</div>
            <div className="h-2 bg-background/40 dark:bg-card/20 border border-border rounded-full overflow-hidden">
              <div
                className={[
                  "h-full rounded-full",
                  riskBucket(c.risk_score) === "crit"
                    ? "bg-red-500"
                    : riskBucket(c.risk_score) === "high"
                      ? "bg-orange-500"
                      : riskBucket(c.risk_score) === "med"
                        ? "bg-amber-400"
                        : "bg-emerald-400",
                ].join(" ")}
                style={{ width: `${rulesTriggeredPct}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">{rulesTriggered} of 28 rules in catalog</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/45 border-border">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
              RFQ Header — Extracted Commercial Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Stat label="Customer" value={c.customer} />
              <Stat label="Program" value={c.program} />
              <Stat label="Part Number" value={c.part_number} mono tone="accent" pill />
              <Stat label="SOP Date" value={c.sop} mono />
              <Stat label="Annual Volume" value={`${c.annual_vol.toLocaleString()} pcs`} mono />
              <Stat label="Material" value={`${c.material} · ${c.thickness} mm`} mono />
              <Stat
                label="PPAP Level"
                value={`Level ${c.ppap}${c.ppap >= 5 ? " ⚠" : ""}`}
                mono
                tone={c.ppap >= 5 ? "destructive" : c.ppap >= 4 ? "accent" : "default"}
              />
              <Stat
                label="Incoterm"
                value={c.incoterm}
                mono
                tone={c.incoterm.startsWith("DDP") ? "accent" : "default"}
              />
              <Stat
                label="Payment Terms"
                value={c.payment}
                mono
                tone={
                  paymentDays >= 120 ? "destructive" : paymentDays >= 75 ? "accent" : "default"
                }
              />
              <Stat
                label="Annual Price Down"
                value={`${c.apd}%/yr${c.apd >= 4 ? " ⚠" : ""}`}
                mono
                tone={c.apd >= 4 ? "destructive" : c.apd >= 3 ? "accent" : "default"}
              />
              <Stat
                label="Tolerance"
                value={c.tolerance}
                mono
                tone={
                  c.tolerance.includes("0.03")
                    ? "accent"
                    : c.tolerance.includes("0.05")
                      ? "warn"
                      : "default"
                }
              />
              <Stat label="Cpk Target" value={c.cpk} mono />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/45 border-border">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
              Extracted Risk Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            {notes.map((n, idx) => {
              const sevLabel = n.severity === "critical" ? "CRITICAL" : n.severity.toUpperCase();
              const sevText =
                n.severity === "critical"
                  ? "text-red-700 dark:text-red-200"
                  : n.severity === "high"
                    ? "text-orange-700 dark:text-orange-200"
                    : n.severity === "medium"
                      ? "text-amber-700 dark:text-amber-200"
                      : "text-emerald-700 dark:text-emerald-200";
              const sevBorder =
                n.severity === "critical"
                  ? "border-red-500/30 dark:border-red-500/50"
                  : n.severity === "high"
                    ? "border-orange-500/30 dark:border-orange-500/45"
                    : n.severity === "medium"
                      ? "border-amber-400/30 dark:border-amber-400/45"
                      : "border-emerald-400/30 dark:border-emerald-400/45";
              const sevBg =
                n.severity === "critical"
                  ? "bg-red-500/14 dark:bg-red-500/10"
                  : n.severity === "high"
                    ? "bg-orange-500/14 dark:bg-orange-500/10"
                    : n.severity === "medium"
                      ? "bg-amber-400/14 dark:bg-amber-400/10"
                      : "bg-emerald-400/14 dark:bg-emerald-400/10";
              const sevChipBg =
                n.severity === "critical"
                  ? "bg-red-500/12 dark:bg-red-500/10"
                  : n.severity === "high"
                    ? "bg-orange-500/12 dark:bg-orange-500/10"
                    : n.severity === "medium"
                      ? "bg-amber-400/12 dark:bg-amber-400/10"
                      : "bg-emerald-400/12 dark:bg-emerald-400/10";

              return (
                <div
                  key={`${n.title}-${idx}`}
                  className={[
                    "rounded-xl border p-4 shadow-sm transition",
                    sevBg,
                    "hover:shadow-md hover:-translate-y-[1px]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="mt-1 text-[12px] font-semibold leading-tight whitespace-normal break-words tracking-tight rfq-risk-notes-title-offset"
                      title={n.title}
                    >
                      {n.title}
                    </div>
                    <div
                      className={[
                        "text-[10px] font-mono uppercase tracking-wider rounded-md border px-2 py-1 whitespace-nowrap",
                        sevChipBg,
                        sevText,
                        sevBorder,
                      ].join(" ")}
                    >
                      {sevLabel}
                    </div>
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{n.body}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
