"use client";

import { GapDocumentControls } from "@/components/rfq/gaps/GapDocumentControls";
import {
  catDeptLabel,
  documentStatusPillCls,
  gapDocumentStatusLabel,
  MiniStat,
} from "@/components/rfq/gaps/GapStatusUi";
import type { CaseData, GapFinding, GapWorkflowStatus } from "@/data/rfqTypes";
import { resolveGapSupplyState } from "@/lib/rfq/gapSupplyState";

export type GapFindingRowProps = {
  f: GapFinding;
  caseData: CaseData;
  supplyDocBusySlot: string | null;
  supplyInputBaseId: string;
  onSupplyMissingDoc: (slotName: string, file: File) => void;
  onRemoveSuppliedDoc: (slotName: string, rule: string) => void;
  onFinalizeGapDoc: (slotName: string, rule: string) => void;
  onWorkflowChange: (rule: string, status: GapWorkflowStatus) => void;
};

/** One gap finding: severity, impact, its linked document slot, and workflow controls. */
export function GapFindingRow({
  f,
  caseData,
  supplyDocBusySlot,
  supplyInputBaseId,
  onSupplyMissingDoc,
  onRemoveSuppliedDoc,
  onFinalizeGapDoc,
  onWorkflowChange,
}: GapFindingRowProps) {
  const {
    workflow: wf,
    docStatus,
    linkedDoc,
    closed,
    supplySlot,
    supplySlotDoc,
    supplyLabel,
    sessionUpload,
  } = resolveGapSupplyState(caseData, f);

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

      <div className="p-4 space-y-2">

        {/* Title row + file details + response button */}
        <div className="flex items-start justify-between gap-3">
          <div className="font-semibold text-[13px] min-w-0" title={f.title}>{f.title}</div>
          <GapDocumentControls
            f={f}
            supplySlot={supplySlot}
            supplySlotDoc={supplySlotDoc}
            supplyLabel={supplyLabel}
            sessionUpload={sessionUpload}
            supplyDocBusySlot={supplyDocBusySlot}
            supplyInputBaseId={supplyInputBaseId}
            onSupplyMissingDoc={onSupplyMissingDoc}
            onRemoveSuppliedDoc={onRemoveSuppliedDoc}
            onFinalizeGapDoc={onFinalizeGapDoc}
          />
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
  );
}
