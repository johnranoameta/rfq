"use client";

import type { DocEntry } from "@/data/rfqTypes";
import type { gapDocumentStatus } from "@/lib/rfq/reconcileGapsWithDocuments";

/** Labels, pill styling and severity chips used by the gap panel. */

export function gapDocumentStatusLabel(status: ReturnType<typeof gapDocumentStatus>, doc?: DocEntry): string {
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

export function documentStatusPillCls(status: ReturnType<typeof gapDocumentStatus>): string {
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

export function supplyAcceptForDoc(doc: DocEntry | undefined): string {
  if (!doc) return ".pdf,.xlsx,.xls,.doc,.docx";
  if (doc.type === "comm" || doc.type === "cost") return ".xlsx,.xls";
  return ".pdf,.doc,.docx";
}
export function SeverityPill({
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

export function catDeptLabel(cat: string): string {
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

export function MiniStat({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" }) {
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
