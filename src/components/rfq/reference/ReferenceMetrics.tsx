"use client";

import type { ReactNode } from "react";

import { bandClasses, type ScoreBand } from "@/lib/rfq/referenceMatchScoring";

/** Small presentational pieces shared by the reference-match cards and tables. */

export function Metric({
  label,
  value,
  band,
}: {
  label: string;
  value: string;
  band?: ScoreBand;
}) {
  const cls = band ? bandClasses(band) : "border-border bg-background/25 text-foreground";
  return (
    <div className={["rounded-lg border px-2.5 py-2", cls].join(" ")}>
      <div className="text-[9px] font-mono font-semibold uppercase tracking-[0.12em] opacity-80">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold leading-tight">{value}</div>
    </div>
  );
}

export function CompareLine({
  label,
  currentValue,
  referenceValue,
  mono,
}: {
  label: string;
  currentValue: string;
  referenceValue: string;
  mono?: boolean;
}) {
  const same = currentValue.trim().toLowerCase() === referenceValue.trim().toLowerCase();
  const valueCls = mono ? "font-mono text-[11px]" : "text-[11px]";
  return (
    <div className="rounded border border-border/60 bg-background/30 px-2 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] font-mono uppercase text-muted-foreground/80 w-7 shrink-0">
            New
          </span>
          <span className={[valueCls, "truncate"].join(" ")} title={currentValue}>
            {currentValue}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] font-mono uppercase text-muted-foreground/80 w-7 shrink-0">
            Hist
          </span>
          <span
            className={[
              valueCls,
              "truncate",
              same
                ? "dark:text-emerald-200 text-emerald-700"
                : "dark:text-amber-200 text-amber-800",
            ].join(" ")}
            title={referenceValue}
          >
            {referenceValue}
            {same ? " ✓" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "good" | "warn" | "bad";
}) {
  const toneCls = !tone
    ? active
      ? "border-accent/50 bg-card text-accent dark:text-accent/90"
      : "border-border bg-background/20 text-muted-foreground hover:bg-background/30"
    : tone === "good"
      ? active
        ? "border-emerald-400/50 bg-emerald-400/15 dark:text-emerald-200 text-emerald-700"
        : "border-emerald-400/30 bg-emerald-400/8 dark:text-emerald-200/90 text-emerald-700/90 hover:bg-emerald-400/15"
      : tone === "warn"
        ? active
          ? "border-amber-400/50 bg-amber-400/15 dark:text-amber-200 text-amber-800"
          : "border-amber-400/30 bg-amber-400/8 dark:text-amber-200/90 text-amber-800/90 hover:bg-amber-400/15"
        : active
          ? "border-red-500/50 bg-red-500/15 dark:text-red-200 text-red-700"
          : "border-red-500/30 bg-red-500/8 dark:text-red-200/90 text-red-700/90 hover:bg-red-500/15";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-8 px-3 rounded-lg border font-mono text-[11px] transition",
        toneCls,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-400/35 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700"
      : tone === "warn"
        ? "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800"
        : tone === "bad"
          ? "border-red-500/35 bg-red-500/10 dark:text-red-200 text-red-700"
          : "border-border bg-background/25 text-muted-foreground";
  return (
    <div className={["rounded-xl border px-3 py-2.5", cls].join(" ")}>
      <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] opacity-80">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-mono opacity-75">{hint}</div>
    </div>
  );
}
