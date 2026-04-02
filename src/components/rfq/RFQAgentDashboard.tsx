"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CASES, HISTORICAL, type CaseData, type CaseId } from "@/data/rfqAgentV2";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type TabKey = "overview" | "documents" | "parts" | "gap" | "quote";
type GapFilterKey =
  | "all"
  | "sev-critical"
  | "sev-high"
  | "sev-medium"
  | "sev-low"
  | `cat-${string}`;

const CASE_DOTS: Record<CaseId, "emerald" | "red" | "amber"> = {
  A: "emerald",
  B: "red",
  C: "amber",
};

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

function riskBucket(score: number) {
  if (score >= 80) return "crit" as const;
  if (score >= 60) return "high" as const;
  if (score >= 40) return "med" as const;
  return "low" as const;
}

function sidebarCustomerLabel(customer: string) {
  // Dashboard menu formatting only: remove trailing "Automotive".
  return customer.replace(/\s*Automotive$/i, "").trim();
}

function sidebarProgramLabel(program: string) {
  // Dashboard menu formatting only: remove leading "NB-" prefix.
  return program.replace(/^NB-/, "").trim();
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
    return "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800";
  }
  return "border-emerald-400/35 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700";
}

function riskTextClasses(score: number) {
  const b = riskBucket(score);
  if (b === "crit") return "dark:text-red-200 text-red-700";
  if (b === "high") return "dark:text-orange-200 text-orange-700";
  if (b === "med") return "dark:text-amber-200 text-amber-800";
  return "dark:text-emerald-200 text-emerald-700";
}

function riskPillBgOnly(score: number) {
  const b = riskBucket(score);
  if (b === "crit") return "bg-red-500/15 dark:bg-red-500/10";
  if (b === "high") return "bg-orange-500/15 dark:bg-orange-500/10";
  if (b === "med") return "bg-amber-400/15 dark:bg-amber-400/10";
  return "bg-emerald-400/15 dark:bg-emerald-400/10";
}

function statusBadgeClasses(c: CaseData) {
  if (c.completeness === "complete" && c.risk_score < 40) {
    return "border-emerald-400/40 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700";
  }
  if (c.completeness === "incomplete") {
    return "border-red-500/40 bg-red-500/15 dark:text-red-200 text-red-700";
  }
  if (c.risk_score >= 80) {
    return "border-red-500/40 bg-red-500/15 dark:text-red-200 text-red-700";
  }
  if (c.risk_score >= 60) {
    return "border-orange-500/40 bg-orange-500/15 dark:text-orange-200 text-orange-700";
  }
  return "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800";
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function RFQAgentDashboard() {
  const [caseId, setCaseId] = useState<CaseId>("A");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [gapFilter, setGapFilter] = useState<GapFilterKey>("all");
  const [expandedRule, setExpandedRule] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const c = CASES[caseId];

  const docMissingCount = useMemo(() => c.docs.filter((d) => d.status === "miss").length, [c.docs]);
  const docConfidenceSummary = useMemo(() => {
    const ok = c.docs.filter((d) => d.status === "ok" && typeof d.conf === "number");
    if (ok.length === 0) return null;
    const avg = ok.reduce((a, d) => a + (d.conf ?? 0), 0) / ok.length;
    return avg;
  }, [c.docs]);

  const tabMeta = useMemo(() => {
    const missing = c.docs.filter((d) => d.status === "miss").length;
    const highGaps = c.gap_findings.filter((f) => f.sev === "high").length;
    const criticalGaps = c.gap_findings.filter((f) => f.sev === "critical").length;
    const gapCount = c.gap_findings.length;
    return {
      docCountText: missing ? `${c.docs.length} • ${missing} missing` : `${c.docs.length}`,
      docPillVariant: missing ? "destructive" : "secondary",
      gapCount,
      gapPillVariant: criticalGaps > 0 ? "destructive" : highGaps > 3 ? "accent" : highGaps > 0 ? "secondary" : "default",
    };
  }, [c.docs, c.gap_findings]);

  const gapFindingsFiltered = useMemo(() => {
    const findings = c.gap_findings;
    if (gapFilter === "all") return findings;
    if (gapFilter.startsWith("sev-")) {
      const sev = gapFilter.replace("sev-", "") as CaseData["gap_findings"][number]["sev"];
      return findings.filter((f) => f.sev === sev);
    }
    if (gapFilter.startsWith("cat-")) {
      const cat = gapFilter.replace("cat-", "");
      return findings.filter((f) => f.cat === cat);
    }
    return findings;
  }, [c.gap_findings, gapFilter]);

  const catOptions = useMemo(() => {
    const set = new Set(c.gap_findings.map((f) => f.cat));
    return Array.from(set).sort();
  }, [c.gap_findings]);

  const workflowSteps = useMemo(() => {
    return [
      { n: 1, l: "Upload", s: c.completeness !== "missing" ? "done" : "idle" },
      { n: 2, l: "Parse", s: c.docs.some((d) => d.status === "ok") ? "done" : "active" },
      { n: 3, l: "Normalize", s: "done" },
      { n: 4, l: "Gap Review", s: "active" },
      { n: 5, l: "Quote", s: c.risk_score < 40 ? "active" : "idle" },
      { n: 6, l: "Submit", s: "idle" },
      { n: 7, l: "Outcome", s: "idle" },
    ] as const;
  }, [c.completeness, c.docs, c.risk_score]);

  const notes = useMemo(() => {
    const map: Record<CaseId, { title: string; body: string; severity: "low" | "medium" | "high" | "critical" }[]> =
      {
        A: [
          {
            title: "Annual Price Reduction",
            body: `2% annual reduction after Year 1 must be modeled in the business case. At ${c.annual_vol.toLocaleString()} units and $4.08 launch price, cumulative impact over 5 years is approx. $160K.`,
            severity: "medium",
          },
          {
            title: "Package Complete",
            body: "All 4 required documents received and parsed. Minor packaging cost gap is resolvable before quote release.",
            severity: "low",
          },
        ],
        B: [
          {
            title: "Incomplete Package — Quote Blocked",
            body: "Packaging spec and DV/PV test standard are both missing. Quote cannot be released in this state.",
            severity: "high",
          },
          {
            title: "Appearance Approval Timeline Risk",
            body: "Appearance sample approval is required prior to PPAP. This milestone can impact SOP commitment.",
            severity: "medium",
          },
        ],
        C: [
          {
            title: "High Risk — Management Review Required",
            body: "Risk score 89/100 with multiple rule triggers (DDP Monterrey, Net 120, PPAP L5, supplier-funded gauges, and 4% APD). Do not submit without Finance and Engineering sign-off.",
            severity: "critical",
          },
          {
            title: "DDP Monterrey Logistics Gap",
            body: "Freight + customs/brokerage are not reflected in the current template. DDP requires a full logistics rebuild.",
            severity: "high",
          },
          {
            title: "4% Annual Price Down Over Program Life",
            body: "4% APD compounds over time and can erode margin by year 5 if floor margin is not validated.",
            severity: "high",
          },
        ],
      };

    return map[caseId];
  }, [caseId, c.annual_vol]);

  const totalDocCount = c.docs.length;
  const missingDocPct = totalDocCount > 0 ? clampPct((totalDocCount - docMissingCount) / totalDocCount * 100) : 0;
  const openHighGaps = c.gap_findings.filter((f) => f.sev === "high").length;
  const openMedGaps = c.gap_findings.filter((f) => f.sev === "medium").length;
  const openCritGaps = c.gap_findings.filter((f) => f.sev === "critical").length;
  const openLowGaps = c.gap_findings.filter((f) => f.sev === "low").length;

  const parsedDocCount = c.docs.length - docMissingCount;
  const completenessPctRounded = Math.round(missingDocPct);
  const completenessTone = missingDocPct >= 85 ? "good" : missingDocPct >= 60 ? "warn" : "bad";

  const rulesTriggered = c.triggered_rules.length;
  const rulesTriggeredPct = Math.round((rulesTriggered / 28) * 100);

  function toggleExpanded(rule: string) {
    setExpandedRule((prev) => ({ ...prev, [rule]: !prev[rule] }));
  }

  function resetExpansions() {
    setExpandedRule({});
  }

  function selectCase(next: CaseId) {
    setCaseId(next);
    setGapFilter("all");
    resetExpansions();
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="h-[52px] w-full border-b border-border/80 bg-secondary/25 backdrop-blur bg-gradient-to-r from-secondary/30 via-secondary/20 to-transparent">
        <div className="h-full flex items-center gap-4 px-5">
          <div className="font-semibold tracking-wider text-xs text-accent dark:text-accent/90 uppercase">
            RFQ<span className="text-muted-foreground font-normal">·</span>Agent
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="font-mono text-[12px] text-foreground px-2.5 py-1 rounded-lg border border-border bg-background/25">
            {c.rfq_num}
          </div>
          <div className="ml-1 flex-1 min-w-0 overflow-hidden">
            <div className="text-sm font-semibold truncate">{c.title} — {c.customer}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex">
              <ThemeToggle />
            </div>
            <div className="hidden sm:block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Risk Score
            </div>
            <div className="px-3 py-1.5 rounded-xl border bg-background/30 backdrop-blur-sm font-mono text-xs font-semibold border-border">
              <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 border leading-none ${riskBadgeClasses(c.risk_score)}`}>
                {c.risk_score}/100
              </span>
            </div>
            <Badge className={["border", statusBadgeClasses(c), "bg-background/30 backdrop-blur-sm"].join(" ")} variant="outline">
              {c.status_label}
            </Badge>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={[
            "border-r border-border bg-secondary/25 flex flex-col overflow-hidden",
            "transition-[width] duration-300 ease-in-out",
            sidebarOpen
              ? "w-[210px] sm:w-[240px] md:w-[260px] lg:w-[290px]"
              : "w-[44px]",
          ].join(" ")}
        >
          <div
            className={[
              "h-[45px] flex items-center border-b border-border bg-secondary/10 rfq-sidebar-header-fixed",
              sidebarOpen ? "px-5 justify-between" : "px-2 justify-center",
            ].join(" ")}
          >
            <div
              className={[
                "text-[10px] font-semibold tracking-[0.12em] leading-none text-muted-foreground uppercase transition-all",
                sidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
              ].join(" ")}
            >
              RFQ Test Cases
            </div>

            <button
              type="button"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              onClick={() => setSidebarOpen((v) => !v)}
              className={[
                "rounded-md border bg-background/20 hover:bg-background/25 text-foreground/80 dark:text-foreground",
                "flex items-center justify-center",
                "h-7 w-7 p-0",
                sidebarOpen
                  ? "border-border"
                  : "border-accent/70 bg-accent/15 hover:bg-accent/20 ring-1 ring-accent/25 shadow-[0_0_10px_rgba(99,102,241,0.25)]",
                "transition",
              ].join(" ")}
            >
              <span className="font-mono text-[14px] font-bold leading-none">
                {sidebarOpen ? "X" : "+"}
              </span>
            </button>
          </div>

          <div className={["flex-1 overflow-y-auto", sidebarOpen ? "p-2" : "p-1"].join(" ")}>
            <div className="space-y-2 pb-3">
              {(
                Object.keys(CASES) as CaseId[]
              ).map((id) => {
                const item = CASES[id];
                const active = id === caseId;
                const dot = CASE_DOTS[id];
                const dotCls =
                  dot === "emerald"
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.35)]"
                    : dot === "red"
                      ? "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.35)]"
                      : "bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.35)]";

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectCase(id)}
                    className={[
                      "group w-full text-left rounded-2xl border border-border bg-card/60 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      sidebarOpen ? "p-4 sm:p-3" : "p-2",
                      active
                        ? "border-accent/70 bg-card ring-1 ring-accent/20"
                        : "hover:bg-card hover:border-accent/35 hover:shadow-md",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "flex min-w-0",
                        sidebarOpen ? "items-start gap-2" : "items-center justify-center",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          sidebarOpen ? "mt-1" : "mt-0",
                          "w-2.5 h-2.5 rounded-full transition",
                          dotCls,
                          active ? "ring-1 ring-accent/60 scale-110" : "group-hover:scale-105",
                        ].join(" ")}
                      />
                      {sidebarOpen ? (
                        <div className="flex-1 min-w-0">
                          <>
                            <div
                              className={[
                                "font-mono text-[10px] uppercase tracking-wide transition",
                                active
                                  ? "text-accent dark:text-accent/90 font-bold"
                                  : "text-muted-foreground group-hover:text-accent/90",
                              ].join(" ")}
                            >
                              {item.id} · {item.part_number}
                            </div>
                            <div
                              className="mt-1 text-[12px] font-semibold leading-tight whitespace-normal break-words tracking-tight"
                              title={item.title}
                            >
                              {item.title}
                            </div>
                            <div className="mt-1 flex items-center gap-2 min-w-0">
                              <div className="text-[11px] font-mono text-muted-foreground break-words whitespace-normal">
                                {sidebarCustomerLabel(item.customer)} / {sidebarProgramLabel(item.program)}
                              </div>
                            </div>
                          </>
                        </div>
                      ) : null}
                      {sidebarOpen ? (
                        <div
                          className={[
                            "font-mono rounded-xl border transition self-start flex-none shrink-0 mt-1",
                            "text-[10px] px-3 py-2 !pt-[2px] !pb-[2px]",
                            "border-accent/70 ring-1 ring-accent/20",
                            riskPillBgOnly(item.risk_score),
                          ].join(" ")}
                          style={{
                            marginTop: -5,
                            paddingTop: 2,
                            paddingBottom: 2,
                          }}
                        >
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${riskTextClasses(
                              item.risk_score
                            )}`}
                          >
                            Score {item.risk_score}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {sidebarOpen ? (
              <Card className="m-1 bg-card/45 border-border">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    Historical Reference
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-[12px] text-muted-foreground leading-relaxed space-y-3">
                  <div className="font-mono text-[11px]">
                    <span className="text-accent dark:text-accent/90">18 submitted projects</span>
                  </div>
                  <div className="font-mono text-[11px]">
                    <span className="dark:text-emerald-200 text-emerald-700">14 Won</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="dark:text-red-200 text-red-700">4 Lost</span>
                  </div>
                  <div className="pt-1 font-mono text-[11px] text-muted-foreground">
                    NorthBridge Automotive<br />
                    <span className="text-[11px]">SPCC / SPHC / SPFC family</span>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <nav className="flex items-center gap-1 border-b border-border bg-secondary/20 px-2 py-1 overflow-x-auto flex-nowrap">
            {(
              [
                { key: "overview", label: "Overview" },
                { key: "documents", label: "Documents" },
                { key: "parts", label: "Part Detail" },
                { key: "gap", label: "Gap Analysis" },
                { key: "quote", label: "Quote & Benchmark" },
              ] as const
            ).map((t) => {
              const active = t.key === activeTab;
              let pill: ReactNode = null;
              if (t.key === "documents") {
                pill = (
                  <Badge
                    variant="secondary"
                    className={[
                      "ml-2",
                      docMissingCount ? "border-destructive/40 bg-red-500/10 dark:text-red-200 text-red-700" : "",
                    ].join(" ")}
                  >
                    {tabMeta.docCountText}
                  </Badge>
                );
              }
              if (t.key === "gap") {
                pill = (
                  <Badge
                    variant="secondary"
                    className={[
                      "ml-2",
                      openHighGaps > 3
                        ? "border-destructive/40 bg-orange-500/10 dark:text-orange-200 text-orange-700"
                        : openHighGaps > 0
                          ? "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800"
                          : "",
                    ].join(" ")}
                  >
                    {tabMeta.gapCount} total
                  </Badge>
                );
              }

              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={[
                    "h-9 px-3 rounded-xl text-[13px] font-semibold transition whitespace-nowrap flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active ? "bg-card border border-accent/40 text-accent dark:text-accent/90" : "text-muted-foreground hover:text-foreground hover:bg-card/50",
                  ].join(" ")}
                >
                  {t.label}
                  {pill}
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === "overview" && (
              <div className="space-y-4">
                <Card className="bg-card/45 border-border">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Workflow
                      </div>
                      <div className="h-px flex-1 bg-border" />
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {docConfidenceSummary ? `Avg conf: ${(docConfidenceSummary * 100).toFixed(0)}%` : "Confidence pending"}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      {workflowSteps.map((s, i) => {
                        const done = s.s === "done";
                        const active = s.s === "active";
                        const idle = s.s === "idle";

                        const circleCls = done
                          ? "bg-emerald-400/15 border-emerald-400/40 dark:text-emerald-200 text-emerald-700"
                          : active
                            ? "bg-accent/15 border-accent/50 text-accent dark:text-accent/90"
                            : idle
                              ? "bg-card/40 border-border text-muted-foreground"
                              : "bg-card/40 border-border text-muted-foreground";

                        const lineCls =
                          i < workflowSteps.length - 1
                            ? done
                              ? "bg-emerald-400/60"
                              : "bg-border"
                            : "";

                        return (
                          <div key={s.n} className="flex items-center gap-3 flex-1 min-w-[120px]">
                            <div
                              className={[
                                "w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs font-semibold",
                                circleCls,
                              ].join(" ")}
                            >
                              {s.n}
                            </div>
                            <div className="flex flex-col">
                              <div className="text-[11px] font-semibold text-foreground">
                                {s.l}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground">
                                {done ? "done" : active ? "in progress" : "pending"}
                              </div>
                            </div>
                            {i < workflowSteps.length - 1 && (
                              <div className={["h-[2px] flex-1 rounded-full", lineCls].join(" ")} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

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
                        <div className="font-mono text-3xl font-semibold">
                          {completenessPctRounded}%
                        </div>
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
                          {c.gap_findings.length} total
                        </div>
                      </div>

                      <div className="font-mono text-3xl font-semibold">{c.gap_findings.length}</div>

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
                        <span className="font-semibold">{riskLabel(c.risk_score)}</span>{" "}
                        —{" "}
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
                          className={["h-full rounded-full", riskBucket(c.risk_score) === "crit" ? "bg-red-500" : riskBucket(c.risk_score) === "high" ? "bg-orange-500" : riskBucket(c.risk_score) === "med" ? "bg-amber-400" : "bg-emerald-400"].join(" ")}
                          style={{ width: `${rulesTriggeredPct}%` }}
                        />
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {rulesTriggered} of 28 rules in catalog
                      </div>
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
                        <Stat label="Customer" value={c.customer} mono={false} />
                        <Stat label="Program" value={c.program} mono={false} />
                        <Stat label="Part Number" value={c.part_number} mono tone="accent" pill />
                        <Stat label="SOP Date" value={c.sop} mono />
                        <Stat
                          label="Annual Volume"
                          value={`${c.annual_vol.toLocaleString()} pcs`}
                          mono
                        />
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
                        <Stat label="Payment Terms" value={c.payment} mono tone={Number(c.payment.split(" ")[1]) >= 120 ? "destructive" : Number(c.payment.split(" ")[1]) >= 75 ? "accent" : "default"} />
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
                          tone={c.tolerance.includes("0.03") ? "accent" : c.tolerance.includes("0.05") ? "warn" : "default"}
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
                        const sevLabel =
                          n.severity === "critical" ? "CRITICAL" : n.severity.toUpperCase();

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
                            <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                              {n.body}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="space-y-4">
                <Card className="bg-card/45 border-border">
                  <CardHeader className="p-5 pb-3">
                    <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
                      Package Files — {c.docs.length} Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0">
                    <Table className="text-[12px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                            File Name
                          </TableHead>
                          <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                            Type
                          </TableHead>
                          <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                            Status
                          </TableHead>
                          <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                            Confidence
                          </TableHead>
                          <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                            Notes
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {c.docs.map((d) => {
                          const tagMap: Record<string, string> = {
                            rfq: "RFQ Main",
                            cost: "Cost Template",
                            draw: "Drawing",
                            pkg: "Packaging",
                            test: "Test Spec",
                            q: "Questionnaire",
                          };
                          const tagCls =
                            d.type === "rfq"
                              ? "border-primary/35 bg-primary/10 text-primary dark:border-primary/45 dark:bg-primary/6 dark:text-primary/90"
                              : d.type === "cost"
                                ? "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800"
                                : d.type === "draw"
                                  ? "border-emerald-400/30 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700"
                                  : d.type === "pkg"
                                    ? "border-orange-500/30 bg-orange-500/10 dark:text-orange-200 text-orange-700"
                                    : d.type === "test"
                                      ? "border-cyan-500/30 bg-cyan-500/10 dark:text-cyan-200 text-cyan-800"
                                      : "border-violet-500/30 bg-violet-500/10 dark:text-violet-200 text-violet-700";

                          const statusText =
                            d.status === "ok" ? "Parsed" : d.status === "miss" ? "Missing" : "Pending";

                          const statusCls =
                            d.status === "ok"
                              ? "border-emerald-400/30 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700"
                              : d.status === "miss"
                                ? "border-red-500/30 bg-red-500/10 dark:text-red-200 text-red-700"
                                : "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800";

                          const conf =
                            d.conf === null ? null : clampPct(d.conf * 100);

                          const confRow =
                            conf === null ? (
                              <span className="text-muted-foreground font-mono text-[11px]">—</span>
                            ) : (
                              <div className="w-[160px] max-w-full">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={[
                                      "font-mono text-[11px] font-semibold",
                                      conf >= 90
                                        ? "dark:text-emerald-200 text-emerald-700"
                                        : conf >= 75
                                          ? "dark:text-amber-200 text-amber-800"
                                          : "dark:text-orange-200 text-orange-700",
                                    ].join(" ")}
                                  >
                                    {(conf / 100).toFixed(2)}
                                  </div>
                                  <div className="h-2 w-full bg-card/40 border border-border rounded-full overflow-hidden">
                                    <div
                                      className={[
                                        "h-full",
                                        conf >= 90
                                          ? "bg-emerald-400"
                                          : conf >= 75
                                            ? "bg-amber-400"
                                            : "bg-orange-500",
                                      ].join(" ")}
                                      style={{ width: `${conf}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );

                          return (
                            <TableRow key={d.name} className="hover:bg-muted/30">
                              <TableCell>
                                <div
                                  className={[
                                    "font-mono text-[11px]",
                                    d.status === "miss"
                                      ? "dark:text-red-200 text-red-700"
                                      : d.status === "pend"
                                        ? "dark:text-amber-200 text-amber-800"
                                        : "text-foreground",
                                  ].join(" ")}
                                >
                                  {d.status === "miss" ? "⚠ " : ""}
                                  {d.name}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={["inline-flex rounded-md border px-2 py-1 text-[10px] font-mono", tagCls].join(" ")}>
                                  {tagMap[d.type]}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={["inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-mono", statusCls].join(" ")}>
                                  {statusText}
                                </span>
                              </TableCell>
                              <TableCell>{confRow}</TableCell>
                              <TableCell className="text-muted-foreground text-[11px] leading-relaxed">
                                {d.note}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="mt-4 rounded-xl border p-4 text-sm shadow-sm relative overflow-hidden">
                      <div
                        className={[
                          "absolute left-0 top-0 bottom-0 w-1",
                          docMissingCount >= 2
                            ? "bg-red-500/80"
                            : docMissingCount === 1
                              ? "bg-amber-400/80"
                              : "bg-emerald-400/80",
                        ].join(" ")}
                      />

                      <div
                        className={[
                          "ml-3 pl-0",
                          docMissingCount >= 2
                            ? "bg-red-500/8 border-red-500/25 dark:bg-red-500/10 dark:border-red-500/45"
                            : docMissingCount === 1
                              ? "bg-amber-400/8 border-amber-400/25 dark:bg-amber-400/10 dark:border-amber-400/45"
                              : "bg-emerald-400/8 border-emerald-400/25 dark:bg-emerald-400/10 dark:border-emerald-400/45",
                        ].join(" ")}
                      >
                        <div className="font-semibold text-foreground mb-1">
                          Overall Completeness Risk:{" "}
                          <span
                            className={[
                              "inline-flex items-center rounded-md border px-2 py-0.5 ml-1 text-[11px] font-mono font-semibold",
                              docMissingCount >= 2
                                ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200"
                                : docMissingCount === 1
                                  ? "border-amber-400/35 bg-amber-400/10 text-amber-800 dark:text-amber-200"
                                  : "border-emerald-400/35 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200",
                            ].join(" ")}
                          >
                            {docMissingCount >= 2 ? "HIGH" : docMissingCount === 1 ? "MEDIUM" : "LOW"}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          {docMissingCount === 0
                            ? "All referenced documents received and parsed successfully."
                            : `${docMissingCount} referenced document${docMissingCount > 1 ? "s are" : " is"} missing. ${
                                docMissingCount >= 2
                                  ? "Quote release is blocked until resolved or assumptions are documented."
                                  : "Address before final quote release."
                              }`}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "parts" && (
              <div className="space-y-4">
                <Card className="bg-card/50 border-border overflow-hidden">
                  <CardHeader className="p-5 pb-3 border-b border-border bg-secondary/15">
                    <div className="flex items-start gap-4">
                      <div>
                        <div className="font-mono text-sm text-accent dark:text-accent/90 font-semibold">{c.part_number}</div>
                        <div className="text-lg font-semibold">{c.title}</div>
                      </div>
                      <div className="ml-auto">
                        <span className="inline-flex items-center rounded-md border border-accent/30 bg-accent/8 px-3 py-1 font-mono text-[11px] text-accent dark:text-accent/90">
                          {c.process[0]}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      <KeyValue label="Customer" value={c.customer} />
                      <KeyValue label="Program" value={c.program} />
                      <KeyValue label="SOP Date" value={c.sop} mono />
                      <KeyValue label="Annual Volume" value={`${c.annual_vol.toLocaleString()}`} mono />
                      <KeyValue
                        label="Material Grade"
                        value={c.material}
                        mono
                        tone={
                          c.material.includes("980")
                            ? "destructive"
                            : c.material.includes("SPFC")
                              ? "accent"
                              : "default"
                        }
                      />
                      <KeyValue label="Thickness" value={`${c.thickness} mm`} mono />
                      <KeyValue
                        label="General Tolerance"
                        value={c.tolerance}
                        mono
                        tone={c.tolerance.includes("0.03") ? "destructive" : c.tolerance.includes("0.05") ? "accent" : "default"}
                      />
                      <KeyValue
                        label="Critical Tolerance"
                        value={c.critical_tol}
                        mono
                        tone={c.critical_tol.includes("0.03") ? "destructive" : "default"}
                      />
                      <KeyValue
                        label="PPAP Level"
                        value={`Level ${c.ppap}${c.ppap >= 5 ? " ⚠" : ""}`}
                        mono
                        tone={c.ppap >= 5 ? "destructive" : c.ppap >= 4 ? "accent" : "default"}
                      />
                      <KeyValue label="Cpk Target" value={c.cpk} mono />
                      <KeyValue
                        label="Incoterm"
                        value={c.incoterm}
                        mono
                        tone={c.incoterm.startsWith("DDP") ? "accent" : "default"}
                      />
                      <KeyValue label="Process Route" value={c.process.join(" → ")} />
                    </div>

                    <div className="pt-2 border-t border-border">
                      <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-3">
                        Surface Requirements
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {c.surface.map((s) => (
                          <span key={s} className="inline-flex rounded-full border border-border bg-background/35 px-3 py-1 text-[11px] font-mono text-muted-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-3">
                        Compliance Flags
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <FlagBadge tone="accent">PPAP L{c.ppap}</FlagBadge>
                        <FlagBadge tone={c.completeness === "complete" ? "good" : "bad"}>
                          Packaging Spec {c.completeness === "complete" ? "✓" : "⚠ Missing"}
                        </FlagBadge>
                        <FlagBadge tone={c.triggered_rules.includes("RULE_002") ? "bad" : "good"}>
                          Test Standard {c.triggered_rules.includes("RULE_002") ? "⚠ Missing" : "✓"}
                        </FlagBadge>
                        {c.supplier_funded_gauges ? (
                          <FlagBadge tone="warn">Supplier-Funded Gauges</FlagBadge>
                        ) : null}
                        {c.incoterm.startsWith("DDP") ? (
                          <FlagBadge tone="warn">DDP — Supplier Manages Freight</FlagBadge>
                        ) : null}
                        {c.apd >= 4 ? (
                          <FlagBadge tone="bad">{c.apd}% APD ⚠</FlagBadge>
                        ) : (
                          <FlagBadge tone="good">{c.apd}% APD</FlagBadge>
                        )}
                        {c.payment.includes("120") ? (
                          <FlagBadge tone="bad">Net 120 ⚠</FlagBadge>
                        ) : c.payment.includes("75") || c.payment.includes("60") ? (
                          <FlagBadge tone="good">{c.payment}</FlagBadge>
                        ) : (
                          <FlagBadge tone="warn">{c.payment}</FlagBadge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "gap" && (
              <div className="space-y-4">
                <Card className="bg-card/50 border-border">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                        Gap Analysis
                      </div>
                      <div className="text-[12px] text-muted-foreground font-mono">
                        {c.gap_findings.length} findings
                      </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <SeverityPill
                        sev="critical"
                        count={c.gap_findings.filter((f) => f.sev === "critical").length}
                        active={gapFilter === "sev-critical"}
                        onClick={() => setGapFilter("sev-critical")}
                      />
                      <SeverityPill
                        sev="high"
                        count={c.gap_findings.filter((f) => f.sev === "high").length}
                        active={gapFilter === "sev-high"}
                        onClick={() => setGapFilter("sev-high")}
                      />
                      <SeverityPill
                        sev="medium"
                        count={c.gap_findings.filter((f) => f.sev === "medium").length}
                        active={gapFilter === "sev-medium"}
                        onClick={() => setGapFilter("sev-medium")}
                      />
                      <SeverityPill
                        sev="low"
                        count={c.gap_findings.filter((f) => f.sev === "low").length}
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
                        All ({c.gap_findings.length})
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
                        All ({c.gap_findings.length})
                      </button>
                      {c.gap_findings.some((f) => f.sev === "high") ? (
                        <button
                          type="button"
                          onClick={() => setGapFilter("sev-high")}
                          className={filterButtonCls(gapFilter === "sev-high")}
                        >
                          High ({c.gap_findings.filter((f) => f.sev === "high").length})
                        </button>
                      ) : null}
                      {c.gap_findings.some((f) => f.sev === "medium") ? (
                        <button
                          type="button"
                          onClick={() => setGapFilter("sev-medium")}
                          className={filterButtonCls(gapFilter === "sev-medium")}
                        >
                          Medium ({c.gap_findings.filter((f) => f.sev === "medium").length})
                        </button>
                      ) : null}
                      {c.gap_findings.some((f) => f.sev === "low") ? (
                        <button
                          type="button"
                          onClick={() => setGapFilter("sev-low")}
                          className={filterButtonCls(gapFilter === "sev-low")}
                        >
                          Low ({c.gap_findings.filter((f) => f.sev === "low").length})
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
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                onClick={() => toggleExpanded(f.rule)}
                                className="w-full text-left focus-visible:outline-none"
                              >
                                <div className="p-4 grid grid-cols-[180px_1fr_170px] items-start gap-3">
                                  <div className="flex items-start gap-3">
                                    <div className={["mt-2 w-2.5 h-2.5 rounded-full shadow-sm", sevColor].join(" ")} />
                                    <div className="font-mono text-[10px] text-muted-foreground border border-border bg-background/20 rounded-md px-2 py-0.5 whitespace-nowrap">
                                      {f.rule}
                                    </div>
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

                                  <div className="flex items-center justify-end gap-2">
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
                                      className="h-8 rounded-lg border border-border bg-background/25 px-2 text-[11px] font-mono text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={() => {}}
                                      defaultValue="Open"
                                    >
                                      <option>Open</option>
                                      <option>In Review</option>
                                      <option>Resolved</option>
                                      <option>Accepted Risk</option>
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
            )}

            {activeTab === "quote" && (
              <div className="space-y-4">
                <Card className="bg-card/50 border-border overflow-hidden">
                  <CardHeader className="p-5 pb-3 border-b border-border bg-secondary/15">
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex-1">
                        <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground font-mono">
                          Quote Summary
                        </div>
                        <div className="mt-1 font-semibold text-lg">{c.quote.version}</div>
                        <div className="text-[12px] text-muted-foreground mt-1">
                          Prepared by <span className="font-mono">{c.quote.prepared_by}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={["border", riskBadgeClasses(c.quote.risk_score), "bg-background/30"].join(" ")}>
                          Risk {c.quote.risk_score}/100
                        </Badge>
                        <Button
                          variant="outline"
                          className="border-accent/40 text-accent dark:text-accent/90 hover:bg-accent/10"
                          onClick={() => {
                            alert("Export PDF is a placeholder in this demo.");
                          }}
                        >
                          Export PDF
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                      <SummaryStat label="Tooling (est.)" value={`$${c.quote.total_tooling.toLocaleString()}`} accent />
                      <SummaryStat
                        label="Est. Annual Rev."
                        value={`$${formatMoney(c.quote.lines[0].price * c.quote.lines[0].vol)}`}
                      />
                      <SummaryStat
                        label="Risk Score"
                        value={`${c.quote.risk_score}/100`}
                        accent
                      />
                      <SummaryStat
                        label="Line Count"
                        value={`${c.quote.lines.length}`}
                      />
                      <SummaryStat
                        label="PPAP"
                        value={`L${c.ppap}`}
                      />
                      <SummaryStat
                        label="Incoterm"
                        value={c.incoterm}
                      />
                    </div>

                    <Card className="bg-card/35 border-border">
                      <CardHeader className="p-4 pb-2 border-b border-border bg-secondary/10">
                        <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
                          Quote Line Items
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <Table className="text-[12px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Part Number
                              </TableHead>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Description
                              </TableHead>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Plant
                              </TableHead>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Volume
                              </TableHead>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Unit Price
                              </TableHead>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Tooling
                              </TableHead>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Packaging/pc
                              </TableHead>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Quality/pc
                              </TableHead>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Freight/pc
                              </TableHead>
                              <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">
                                Margin
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {c.quote.lines.map((l) => (
                              <TableRow key={l.pn} className="hover:bg-muted/30">
                                <TableCell>
                                  <span className="font-mono text-[11px] text-accent dark:text-accent/90">{l.pn}</span>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  <span className="text-[12px]">{l.name}</span>
                                </TableCell>
                                <TableCell>{l.plant}</TableCell>
                                <TableCell className="font-mono">{l.vol.toLocaleString()}</TableCell>
                                <TableCell className="font-mono">${l.price.toFixed(2)}</TableCell>
                                <TableCell className="font-mono">${l.tooling.toLocaleString()}</TableCell>
                                <TableCell className="font-mono">
                                  <span className={l.pkg === 0 ? "dark:text-red-200 text-red-700" : "text-foreground"}>
                                    ${l.pkg.toFixed(2)}{l.pkg === 0 ? " ⚠" : ""}
                                  </span>
                                </TableCell>
                                <TableCell className="font-mono">${l.quality.toFixed(2)}</TableCell>
                                <TableCell className="font-mono">
                                  <span
                                    className={[
                                      "inline-flex items-center gap-1",
                                          l.freight < 0.15 && c.incoterm.startsWith("DDP") ? "dark:text-red-200 text-red-700" : "text-foreground",
                                    ].join(" ")}
                                  >
                                    ${l.freight.toFixed(2)}
                                    {l.freight < 0.15 && c.incoterm.startsWith("DDP") ? "⚠" : ""}
                                  </span>
                                </TableCell>
                                <TableCell className="font-mono">
                                  <span
                                    className={[
                                      l.margin >= 17
                                        ? "dark:text-emerald-200 text-emerald-700"
                                        : l.margin >= 13
                                          ? "dark:text-amber-200 text-amber-800"
                                          : "dark:text-red-200 text-red-700",
                                    ].join(" ")}
                                  >
                                    {l.margin.toFixed(1)}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Card className="bg-card/35 border-border">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
                            Cost Breakdown — USD/pc
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-3">
                          <CostBreakdownBars
                            c={c}
                          />
                        </CardContent>
                      </Card>

                    <Card className="bg-card/35 border-border">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
                            Historical Benchmark — {c.quote.hist_match.length} Projects Matched
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-3">
                          <HistoricalBenchmark c={c} />
                          {c.risk_score >= 60 ? (
                            <div
                              className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-muted-foreground"
                            >
                              <div className="font-semibold dark:text-red-200 text-red-700">
                                Risk Flag
                              </div>
                              <div className="mt-1">
                                {c.id === "B"
                                  ? "Quote release is blocked — missing packaging spec and test standard must be resolved first. Benchmark data is reference only."
                                  : "Multiple cost gaps detected across packaging, logistics, and PPAP L5. Corrected costs are higher than the current template. Management review required before submission."}
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
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

function KeyValue({
  label,
  value,
  mono,
  tone = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "accent" | "destructive";
}) {
  const toneCls =
    tone === "destructive"
      ? "dark:text-red-200 text-red-700"
      : tone === "accent"
        ? "text-accent dark:text-accent/90"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-background/30 p-3.5">
      <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground font-mono">
        {label}
      </div>
      <div className={["mt-1 text-[13px] font-semibold", mono ? "font-mono" : "", toneCls].join(" ")}>
        {value}
      </div>
    </div>
  );
}

function FlagBadge({
  tone,
  children,
}: {
  tone: "good" | "bad" | "warn" | "accent";
  children: ReactNode;
}) {
  const cls =
    tone === "good"
      ? "border-emerald-400/35 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700"
      : tone === "bad"
        ? "border-red-500/35 bg-red-500/10 dark:text-red-200 text-red-700"
        : tone === "warn"
          ? "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800"
          : "border-accent/40 bg-accent/10 text-accent dark:text-accent/90";

  return (
    <span className={["inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-mono", cls].join(" ")}>
      {children}
    </span>
  );
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
  const tone =
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
        "h-9 px-3 rounded-xl border font-mono text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active ? "bg-card" : "bg-background/15 hover:bg-background/25",
        tone,
      ].join(" ")}
    >
      <span className="font-semibold">{count}</span> {sev}
    </button>
  );
}

function filterButtonCls(active: boolean) {
  return [
    "h-9 px-3 rounded-lg border font-mono text-[11px] transition",
    active
      ? "border-accent/50 bg-card text-accent dark:text-accent/90"
      : "border-border bg-background/20 text-muted-foreground hover:bg-background/30",
  ].join(" ");
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
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-[12px] font-semibold">{value}</div>
    </div>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/25 p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono">
        {label}
      </div>
      <div
        className={["mt-2 text-[14px] font-semibold font-mono", accent ? "text-accent dark:text-accent/90" : "text-foreground"].join(
          " ",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function CostBreakdownBars({ c }: { c: CaseData }) {
  const cb = c.quote.cost_breakdown;
  const l = c.quote.lines[0];

  const entries = [
    ["Material", cb.material],
    ["Labor", cb.labor],
    ["Machine", cb.machine],
    ["Overhead", cb.overhead],
    ["Scrap", cb.scrap],
    ["Quality / PPAP", cb.quality],
    ["Logistics", cb.logistics],
    ["Packaging", cb.packaging],
  ] as const;

  const maxV = cb.material;

  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => {
        const isWarn =
          (k === "Packaging" && v === 0) ||
          (k === "Logistics" && v < 0.15 && c.incoterm.startsWith("DDP"));

        const barBg =
          isWarn
            ? "bg-red-500"
            : k === "Scrap"
              ? "bg-orange-500"
              : "bg-amber-400";

        return (
          <div key={k} className="flex items-center gap-3">
            <div className="w-[140px] text-[12px] text-muted-foreground font-semibold">{k}</div>
            <div className="flex-1 h-2 rounded-full border border-border bg-card/40 overflow-hidden">
              <div
                className={["h-full", barBg].join(" ")}
                style={{ width: `${Math.min(100, (v / maxV) * 100)}%` }}
              />
            </div>
            <div className={["w-[90px] text-right font-mono text-[12px] font-semibold", isWarn ? "dark:text-red-200 text-red-700" : "text-foreground"].join(" ")}>
              {isWarn ? "⚠ " : ""}
              ${v.toFixed(2)}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <div className="w-[140px] text-[12px] text-muted-foreground font-semibold">Total Cost</div>
        <div className="flex-1 h-2 rounded-full border border-border bg-card/40 overflow-hidden">
          <div className="h-full bg-primary" style={{ width: "100%" }} />
        </div>
        <div className="w-[90px] text-right font-mono text-[12px] font-semibold text-foreground">
          ${cb.total.toFixed(2)}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-[140px] text-[12px] text-muted-foreground font-semibold">Unit Price</div>
        <div className="flex-1 h-2 rounded-full border border-border bg-card/40 overflow-hidden">
          <div className="h-full bg-accent" style={{ width: "100%" }} />
        </div>
        <div className="w-[90px] text-right font-mono text-[12px] font-semibold text-accent dark:text-accent/90">
          ${l.price.toFixed(2)}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-[140px] text-[12px] text-muted-foreground font-semibold">Gross Margin</div>
        <div className="flex-1 h-2 rounded-full border border-border bg-card/40 overflow-hidden">
          <div
            className="h-full bg-emerald-400"
            style={{ width: `${Math.min(100, l.margin)}%` }}
          />
        </div>
        <div className={[
          "w-[90px] text-right font-mono text-[12px] font-semibold",
          l.margin >= 17 ? "dark:text-emerald-200 text-emerald-700" : l.margin >= 13 ? "dark:text-amber-200 text-amber-800" : "dark:text-red-200 text-red-700",
        ].join(" ")}>
          {l.margin.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

function HistoricalBenchmark({ c }: { c: CaseData }) {
  const histMatched = HISTORICAL.filter((h) => c.quote.hist_match.includes(h.id)).slice(0, 3);
  const [lo, hi] = c.quote.hist_price_band;
  const [tlo, thi] = c.quote.hist_tooling_band;
  const l = c.quote.lines[0];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {histMatched.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/20 px-3 py-2">
            <div className="font-mono text-[12px] text-muted-foreground">{h.id}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-foreground font-semibold truncate">{h.pn} · {h.material}</div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {h.vol.toLocaleString()} pcs · PPAP L{h.ppap}
              </div>
            </div>
            <div className={["font-mono text-[12px] font-semibold", h.award === "Won" ? "dark:text-emerald-200 text-emerald-700" : "dark:text-red-200 text-red-700"].join(" ")}>
              ${h.price.toFixed(2)} · {h.award}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-background/25 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
            Hist. Price Band
          </div>
          <div className="font-mono text-sm font-semibold dark:text-emerald-200 text-emerald-700">
            ${lo.toFixed(2)} – ${hi.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/25 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
            This Quote
          </div>
          <div
            className={[
              "font-mono text-sm font-semibold",
              l.price < lo
                ? "dark:text-red-200 text-red-700"
                : l.price > hi
                  ? "dark:text-amber-200 text-amber-800"
                  : "dark:text-emerald-200 text-emerald-700",
            ].join(" ")}
          >
            ${l.price.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/25 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
            Hist. Tooling Band
          </div>
          <div className="font-mono text-sm font-semibold dark:text-emerald-200 text-emerald-700">
            ${tlo.toLocaleString()} – ${thi.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/25 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
            This Tooling
          </div>
          <div className="font-mono text-sm font-semibold text-accent dark:text-accent/90">
            ${c.quote.total_tooling.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

