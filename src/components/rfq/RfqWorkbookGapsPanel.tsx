"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseData, DocEntry, GapFinding, GapWorkflowStatus } from "@/data/rfqTypes";
import {
  DOC_GAP_CONF_THRESHOLD,
  gapDocumentStatus,
  gapFindingUploadSlot,
  isGapOpenInCase,
} from "@/lib/rfq/reconcileGapsWithDocuments";
import { gapSlotHasSessionUpload } from "@/lib/rfq/applySuppliedPackageDoc";

type GapFilterKey =
  | "all"
  | "sev-critical"
  | "sev-high"
  | "sev-medium"
  | "sev-low"
  | `cat-${string}`;

function gapDocumentStatusLabel(status: ReturnType<typeof gapDocumentStatus>, doc?: DocEntry): string {
  if (status === "missing") return "Document missing";
  if (status === "pending") return "Document pending";
  if (status === "partial") {
    const pct = doc?.conf != null ? `${Math.round(doc.conf * 100)}%` : "low";
    return `Partial match · ${pct} conf`;
  }
  if (status === "finalized") {
    const pct = doc?.conf != null ? `${Math.round(doc.conf * 100)}%` : "ok";
    return `Finalized · ${pct} conf`;
  }
  if (status === "supplied") {
    const pct = doc?.conf != null ? `${Math.round(doc.conf * 100)}%` : "ok";
    return `Document supplied · ${pct} conf`;
  }
  return "";
}

function documentStatusPillCls(status: ReturnType<typeof gapDocumentStatus>): string {
  if (status === "finalized") {
    return "border-violet-400/40 bg-violet-400/10 dark:text-violet-200 text-violet-700";
  }
  if (status === "supplied") {
    return "border-emerald-400/40 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700";
  }
  if (status === "partial") {
    return "border-amber-400/40 bg-amber-400/10 dark:text-amber-200 text-amber-800";
  }
  if (status === "pending") {
    return "border-cyan-500/30 bg-cyan-500/10 dark:text-cyan-200 text-cyan-800";
  }
  if (status === "missing") {
    return "border-orange-500/35 bg-orange-500/10 dark:text-orange-200 text-orange-700";
  }
  return "border-border bg-background/20 text-muted-foreground";
}

function gapRuleSupplySlotLegacy(c: CaseData, rule: string): string | null {
  if (rule === "RULE_001") {
    const d = c.docs.find((x) => x.type === "pkg" && x.status === "miss");
    return d?.name ?? null;
  }
  if (rule === "RULE_002") {
    const d = c.docs.find((x) => x.type === "test" && (x.status === "miss" || x.status === "pend") && x.name.includes("DV_PV"));
    return d?.name ?? null;
  }
  if (rule === "RULE_028") {
    const d = c.docs.find(
      (x) =>
        x.name === "NB-QA-118_Customer_Spec.pdf" ||
        (x.name.includes("NB-QA-118") && x.name.includes("Customer")),
    );
    if (d && (d.status === "miss" || d.status === "pend" || d.supplied_label)) return d.name;
    return d?.name ?? "NB-QA-118_Customer_Spec.pdf";
  }
  if (rule === "RULE_029") {
    const d = c.docs.find((x) => x.type === "comm" && x.status === "ok");
    return d?.name ?? null;
  }
  return null;
}

function supplyAcceptForDoc(doc: DocEntry | undefined): string {
  if (!doc) return ".pdf,.xlsx,.xls,.doc,.docx";
  if (doc.type === "comm" || doc.type === "cost") return ".xlsx,.xls";
  return ".pdf,.doc,.docx";
}

function riskTone(score: number): "good" | "warn" | "bad" {
  if (score < 35) return "good";
  if (score < 55) return "warn";
  return "bad";
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

function catDeptLabel(cat: string): string {
  switch (cat) {
    case "commercial": return "Commercial";
    case "technical": return "Engineering";
    case "completeness": return "Documentation";
    case "quality": return "Quality";
    case "logistics": return "Logistics";
    case "quote": return "Quoting";
    default: return cat;
  }
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
  const openGapCount = caseData.gap_findings.filter((f) => isGapOpenInCase(caseData, f)).length;
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
                <div className="text-[12px] text-muted-foreground font-mono">
                  {openGapCount} open · {caseData.gap_findings.length} total
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
                  All ({caseData.gap_findings.length})
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/15 p-3 space-y-3">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.12em]">Department</div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "commercial", "technical", "completeness", "quality", "logistics", "quote"] as const).map((cat) => {
                  const count = cat === "all"
                    ? caseData.gap_findings.length
                    : caseData.gap_findings.filter((f) => f.cat === cat).length;
                  if (cat !== "all" && count === 0) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDeptFilter(cat)}
                      className={[
                        "h-9 px-3 rounded-xl border font-mono text-[11px] transition",
                        deptFilter === cat
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

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {gapFindingsFiltered.filter((f) => deptFilter === "all" || f.cat === deptFilter).length === 0 ? (
                <div className="text-muted-foreground text-[12px]">No findings match this filter.</div>
              ) : (
                gapFindingsFiltered.filter((f) => deptFilter === "all" || f.cat === deptFilter).map((f) => {
                  const wf = caseData.gap_workflow?.[f.rule] ?? "open";
                  const docStatus = gapDocumentStatus(f, caseData.docs);
                  const linkedDoc = f.doc_slot ? caseData.docs.find((d) => d.name === f.doc_slot) : undefined;
                  const gapOpen = isGapOpenInCase(caseData, f);
                  const closed = !gapOpen;
                  const supplySlot =
                    gapFindingUploadSlot(caseData, f) ?? gapRuleSupplySlotLegacy(caseData, f.rule);
                  const supplySlotDoc = supplySlot ? caseData.docs.find((d) => d.name === supplySlot) : undefined;
                  const supplyLabel =
                    supplySlotDoc?.status === "ok" &&
                    supplySlotDoc.conf != null &&
                    supplySlotDoc.conf < DOC_GAP_CONF_THRESHOLD
                      ? "Replace"
                      : supplySlotDoc?.supplied_label || supplySlotDoc?.finalized
                        ? "Replace"
                        : supplySlotDoc?.status === "ok"
                          ? "Replace"
                          : supplySlot
                            ? "Response"
                            : null;
                  const sessionUpload = supplySlot != null && gapSlotHasSessionUpload(caseData, supplySlot);

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
                        "rounded-xl border border-border/70 bg-card/25 shadow-sm",
                        closed ? "opacity-75 border-emerald-500/20 bg-emerald-500/[0.03]" : "",
                      ].join(" ")}
                    >
                      {/* Card header: department · severity · status · rule */}
                      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 rounded-t-xl bg-background/20">
                        {/* left group: dept + severity + status */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className={["w-2 h-2 rounded-full shrink-0", sevColor].join(" ")} />
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                              {catDeptLabel(f.cat)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span style={{ fontSize: "7px" }} className="font-mono font-medium uppercase tracking-widest text-muted-foreground/40">Severity</span>
                            <div
                              className={[
                                "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold h-6",
                                sevPill,
                              ].join(" ")}
                            >
                              {f.sev.toUpperCase()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span style={{ fontSize: "7px" }} className="font-mono font-medium uppercase tracking-widest text-muted-foreground/40">Status</span>
                            <select
                              className="h-6 rounded-md border border-border bg-background/25 px-2 text-[10px] font-mono text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
                              value={wf}
                              onChange={(e) => {
                                const v = e.target.value as GapWorkflowStatus;
                                onWorkflowChange(f.rule, v);
                              }}
                            >
                              <option value="open">Pending</option>
                              <option value="in_review">In Review</option>
                              <option value="resolved">Resolved</option>
                              <option value="accepted_risk">Accepted Risk</option>
                            </select>
                          </div>
                        </div>
                        {/* rule badge — right */}
                        <div className="font-mono text-[10px] text-muted-foreground border border-border bg-background/20 rounded px-2 py-0.5">
                          {f.rule}
                        </div>
                      </div>

                      <div className="p-4 grid gap-4 items-start" style={{ gridTemplateColumns: "120px 1fr" }}>

                        {/* LEFT: slot + attached file info */}
                        <div className="flex flex-col gap-2 border-r border-border/50 pr-4">
                          {f.doc_slot ? (
                            <div className="font-mono text-[9px] text-muted-foreground/60 truncate" title={f.doc_slot}>
                              {f.doc_slot}
                            </div>
                          ) : null}
                          {supplySlotDoc?.supplied_label ? (
                            <div className="rounded-lg border border-border/70 bg-background/20 px-2 py-1.5 text-[10px] font-mono text-muted-foreground">
                              <span className="text-foreground font-semibold">{supplySlotDoc.supplied_label}</span>
                              {supplySlotDoc.finalized ? (
                                <div className="text-violet-600 dark:text-violet-300">Finalized</div>
                              ) : (
                                <div className="text-amber-700 dark:text-amber-300">Not finalized</div>
                              )}
                            </div>
                          ) : null}
                          {sessionUpload ? (
                            <div className="flex flex-col gap-1">
                              {!supplySlotDoc?.finalized ? (
                                <Button
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  className="h-7 text-[11px] w-full"
                                  disabled={supplyDocBusySlot !== null}
                                  onClick={() => onFinalizeGapDoc(supplySlot!, f.rule)}
                                >
                                  Finalize
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[11px] w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={supplyDocBusySlot !== null}
                                onClick={() => onRemoveSuppliedDoc(supplySlot!, f.rule)}
                              >
                                Remove
                              </Button>
                            </div>
                          ) : null}
                          {supplySlotDoc && supplySlotDoc.conf != null && supplySlotDoc.conf < DOC_GAP_CONF_THRESHOLD ? (
                            <span className="text-[10px] font-mono text-amber-800 dark:text-amber-200">
                              Conf {(supplySlotDoc.conf * 100).toFixed(0)}%
                            </span>
                          ) : null}
                        </div>

                        {/* RIGHT: Title + response + doc status + detail + evidence + action */}
                        <div className="min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-[13px] min-w-0" title={f.title}>{f.title}</div>
                            {supplySlot && supplyLabel ? (
                              <>
                                <input
                                  id={`${supplyInputBaseId}-gap-${f.rule.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                                  type="file"
                                  className="sr-only"
                                  accept={supplyAcceptForDoc(supplySlotDoc)}
                                  disabled={supplyDocBusySlot !== null}
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
                                  className="h-7 text-[11px] shrink-0"
                                  disabled={supplyDocBusySlot !== null}
                                  onClick={() => {
                                    const el = document.getElementById(
                                      `${supplyInputBaseId}-gap-${f.rule.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
                                    ) as HTMLInputElement | null;
                                    el?.click();
                                  }}
                                >
                                  {supplyDocBusySlot === supplySlot ? "Responding…" : supplyLabel}
                                </Button>
                              </>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-mono bg-background/20 dark:bg-background/15 border-border/70 text-muted-foreground">
                              {f.impact}
                            </span>
                            {docStatus !== "none" ? (
                              <div
                                className={[
                                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold",
                                  documentStatusPillCls(docStatus),
                                ].join(" ")}
                                title={linkedDoc?.note ?? undefined}
                              >
                                {gapDocumentStatusLabel(docStatus, linkedDoc)}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-[12px] text-muted-foreground leading-relaxed">{f.detail}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="rounded-xl border border-border bg-background/20 p-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-1.5">
                                Evidence
                              </div>
                              <div className="text-[12px] text-muted-foreground leading-relaxed">{f.evidence}</div>
                            </div>
                            <div className="rounded-xl border border-border bg-background/20 p-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-1.5">
                                Recommended Action
                              </div>
                              <div className="text-[12px] text-muted-foreground leading-relaxed">{f.action}</div>
                            </div>
                          </div>
                          {f.hist ? (
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
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
                      </div>
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
