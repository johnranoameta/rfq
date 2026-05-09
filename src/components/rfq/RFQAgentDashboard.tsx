"use client";

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { applySuppliedPackageDoc } from "@/lib/rfq/applySuppliedPackageDoc";
import { gapFindingUploadSlot } from "@/lib/rfq/reconcileGapsWithDocuments";
import { buildCaseDataFromPersisted } from "@/lib/rfq/caseFromPersisted";
import { loadSidebarListCache, saveSidebarListCache } from "@/lib/rfq/sidebarListCache";
import type { RfqParseSessionFull } from "@/lib/rfq/sqlite/parseSessions";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
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
import type { CaseData, DocType, GapWorkflowStatus } from "@/data/rfqTypes";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SettingsMenu } from "@/components/settings/SettingsMenu";
import { logout as clearAuthSession } from "@/components/auth/rfqAuth";
import { AllRfqsLibrary } from "@/components/rfq/AllRfqsLibrary";
import { RfqPortfolioPanel } from "@/components/rfq/RfqPortfolioPanel";
import {
  OverviewTopReferenceCard,
  RfqReferenceMatchPanel,
} from "@/components/rfq/RfqReferenceMatchPanel";
import {
  RfqPackageUpload,
  STORED_NAME_DB_ONLY,
  type AnalysisStatusEvent,
  type AnalysisStatusKind,
  type UploadedPackageFile,
} from "@/components/rfq/RfqPackageUpload";
import {
  SortableRfqTabBar,
  loadDashboardTabOrder,
  type DashboardTabKey,
} from "@/components/rfq/SortableRfqTabBar";
type GapFilterKey =
  | "all"
  | "sev-critical"
  | "sev-high"
  | "sev-medium"
  | "sev-low"
  | `cat-${string}`;

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

function isGapWorkflowClosed(w: GapWorkflowStatus | undefined): boolean {
  return w === "resolved" || w === "accepted_risk";
}

/** Fallback package slot when a gap has no doc_slot (e.g. DB-backed sessions). */
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

const DOC_TYPE_LABEL: Record<DocType, string> = {
  rfq: "RFQ Main",
  cost: "Cost Template",
  draw: "Drawing",
  pkg: "Packaging",
  test: "Test Spec",
  q: "Questionnaire",
  tech: "Tech Spec",
  qual: "Quality",
  comm: "Commercial",
  nda: "NDA",
};

const DOC_TYPE_BADGE_CLS: Record<DocType, string> = {
  rfq:
    "border-primary/35 bg-primary/10 text-primary dark:border-primary/45 dark:bg-primary/6 dark:text-primary/90",
  cost: "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800",
  draw: "border-emerald-400/30 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700",
  pkg: "border-orange-500/30 bg-orange-500/10 dark:text-orange-200 text-orange-700",
  test: "border-cyan-500/30 bg-cyan-500/10 dark:text-cyan-200 text-cyan-800",
  q: "border-violet-500/30 bg-violet-500/10 dark:text-violet-200 text-violet-700",
  tech: "border-sky-500/30 bg-sky-500/10 dark:text-sky-200 text-sky-800",
  qual: "border-rose-400/30 bg-rose-400/10 dark:text-rose-200 text-rose-800",
  comm: "border-amber-600/30 bg-amber-600/10 dark:text-amber-200 text-amber-900",
  nda: "border-indigo-500/30 bg-indigo-500/10 dark:text-indigo-200 text-indigo-800",
};

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

function uploadedFileFromPersistedRow(row: { session_id: string; original_filename: string }): UploadedPackageFile {
  const lower = row.original_filename.toLowerCase();
  const mimeType = lower.endsWith(".xls")
    ? "application/vnd.ms-excel"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return {
    id: row.session_id,
    originalName: row.original_filename,
    size: 0,
    mimeType,
    storedName: STORED_NAME_DB_ONLY,
  };
}

export default function RFQAgentDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<{
    file: UploadedPackageFile;
    caseData: CaseData;
  } | null>(null);
  /** Every successful upload stays listed here (sidebar) even when the dashboard view is reset. */
  const [uploadedRfqs, setUploadedRfqs] = useState<UploadedPackageFile[]>([]);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [tabOrder, setTabOrder] = useState<DashboardTabKey[]>(() => loadDashboardTabOrder());
  const [activeTab, setActiveTab] = useState<DashboardTabKey>("overview");
  const [gapFilter, setGapFilter] = useState<GapFilterKey>("all");
  const [expandedRule, setExpandedRule] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarLoadBusy, setSidebarLoadBusy] = useState(false);
  /** After first catalog/cache merge; avoids writing an empty cache before hydration runs. */
  const [sidebarHydrated, setSidebarHydrated] = useState(false);
  const supplyInputBaseId = useId();
  const [supplyDocBusySlot, setSupplyDocBusySlot] = useState<string | null>(null);
  const [supplyDocError, setSupplyDocError] = useState<string | null>(null);
  /** Per-file pipeline status (queued/analyzing/done/error) for sidebar progress pills. */
  const [analysisStatus, setAnalysisStatus] = useState<
    Record<string, { status: AnalysisStatusKind; message?: string }>
  >({});

  const handleAnalysisStatus = useCallback((event: AnalysisStatusEvent) => {
    setAnalysisStatus((prev) => ({
      ...prev,
      [event.fileId]: { status: event.status, message: event.message },
    }));
    /** Successful "done" stops self-clearing after a brief delay so the sidebar settles. */
    if (event.status === "done") {
      window.setTimeout(() => {
        setAnalysisStatus((prev) => {
          const cur = prev[event.fileId];
          if (!cur || cur.status !== "done") return prev;
          const next = { ...prev };
          delete next[event.fileId];
          return next;
        });
      }, 4000);
    }
  }, []);

  const handleSupplyMissingDoc = useCallback(async (slotName: string, file: File) => {
    setSupplyDocBusySlot(slotName);
    setSupplyDocError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/rfq/upload", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string; originalName?: string };
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      const label = data.originalName || file.name;
      setSession((prev) => {
        if (!prev?.caseData) return prev;
        return {
          ...prev,
          caseData: applySuppliedPackageDoc(prev.caseData, slotName, label),
        };
      });
    } catch (e) {
      setSupplyDocError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSupplyDocBusySlot(null);
    }
  }, []);

  /**
   * Rehydrate sidebar after refresh/login: SQLite via catalog when possible, else localStorage backup.
   * Logout only clears auth keys — RFQs remain in `data/rfq.sqlite` and in this cache.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let fromSource: UploadedPackageFile[] = [];
      try {
        const r = await fetch("/api/rfq/database/catalog", { cache: "no-store" });
        const data = (await r.json()) as {
          upload_analyses?: { session_id: string; original_filename: string }[];
        };
        const fromApi =
          r.ok && Array.isArray(data.upload_analyses)
            ? data.upload_analyses.map(uploadedFileFromPersistedRow)
            : [];
        const fromCache = loadSidebarListCache();
        if (r.ok) {
          const apiIds = new Set(fromApi.map((u) => u.id));
          fromSource = [...fromApi, ...fromCache.filter((u) => !apiIds.has(u.id))];
        } else {
          fromSource = fromCache;
        }
      } catch {
        if (!cancelled) fromSource = loadSidebarListCache();
      }
      if (cancelled) return;
      setUploadedRfqs((prev) => {
        const seen = new Set<string>();
        const out: UploadedPackageFile[] = [];
        const add = (u: UploadedPackageFile) => {
          if (seen.has(u.id)) return;
          seen.add(u.id);
          out.push(u);
        };
        for (const u of fromSource) {
          add(u);
        }
        for (const u of prev) {
          if (!seen.has(u.id)) add(u);
        }
        return out;
      });
      setSidebarHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sidebarHydrated) return;
    saveSidebarListCache(uploadedRfqs);
  }, [uploadedRfqs, sidebarHydrated]);

  const c = session?.caseData ?? null;

  async function activateRfqFromSidebar(u: UploadedPackageFile) {
    if (pipelineBusy || sidebarLoadBusy) return;
    setSidebarLoadBusy(true);
    setSessionNotice(null);
    try {
      const res = await fetch(`/api/rfq/database/sessions/${encodeURIComponent(u.id)}`, { cache: "no-store" });
      if (res.ok) {
        const row = (await res.json()) as RfqParseSessionFull;
        const fileDb: UploadedPackageFile = {
          id: u.id,
          originalName: u.originalName,
          size: u.size,
          mimeType: u.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          storedName: STORED_NAME_DB_ONLY,
        };
        setSession({ file: fileDb, caseData: buildCaseDataFromPersisted(row, fileDb) });
        setPipelineBusy(false);
        setGapFilter("all");
        setExpandedRule({});
        return;
      }
      setSessionNotice(
        res.status === 404
          ? "No stored analysis for this upload. Run analysis while the workbook file is on the server, or upload the workbook again."
          : `Could not load RFQ (${res.status}).`,
      );
    } catch {
      setSessionNotice("Network error loading stored RFQ.");
    } finally {
      setSidebarLoadBusy(false);
    }
  }

  async function removeRfqFromSidebar(u: UploadedPackageFile) {
    const msg = `Remove “${u.originalName}” from this list and delete its saved analysis from the database?`;
    if (!window.confirm(msg)) return;

    setSidebarLoadBusy(true);
    try {
      await fetch(`/api/rfq/database/sessions/${encodeURIComponent(u.id)}`, { method: "DELETE" });
    } catch {
      /* still drop from sidebar */
    } finally {
      setSidebarLoadBusy(false);
    }

    const nextList = uploadedRfqs.filter((x) => x.id !== u.id);
    setUploadedRfqs(nextList);

    if (session?.file.id === u.id) {
      if (nextList.length > 0) {
        void activateRfqFromSidebar(nextList[0]!);
      } else {
        setSession(null);
        setSessionNotice(null);
      }
    }
  }

  function handleUploaded(file: UploadedPackageFile) {
    setUploadedRfqs((prev) => {
      if (prev.some((u) => u.id === file.id)) return prev;
      return [file, ...prev];
    });
    setSessionNotice(null);
    setSessionNotice(`Stored “${file.originalName}”. Analysis runs only for the 4-sheet workbook format.`);
  }

  async function handleAnalyzed(file: UploadedPackageFile) {
    setUploadedRfqs((prev) => {
      if (prev.some((u) => u.id === file.id)) return prev;
      return [file, ...prev];
    });
    /**
     * Batch-upload race: when N workbooks are dropped at once, every analysis fires this
     * callback. Only auto-activate the dashboard if nothing else is already driving it,
     * so the user's first opened/active RFQ isn't yanked away by a later finisher.
     */
    const hasActiveSession = session !== null;
    if (!hasActiveSession) {
      setSessionNotice(null);
      await activateRfqFromSidebar(file);
      setActiveTab("parts");
    } else if (session.file.id !== file.id) {
      setSessionNotice(
        `Analyzed “${file.originalName}”. Open it from the sidebar when ready.`,
      );
    }
  }

  const docMissingCount = useMemo(
    () => (c ? c.docs.filter((d) => d.status === "miss").length : 0),
    [c],
  );
  const docConfidenceSummary = useMemo(() => {
    if (!c) return null;
    const ok = c.docs.filter((d) => d.status === "ok" && typeof d.conf === "number");
    if (ok.length === 0) return null;
    return ok.reduce((a, d) => a + (d.conf ?? 0), 0) / ok.length;
  }, [c]);

  const tabMeta = useMemo(() => {
    if (!c) {
      return {
        docCountText: "—",
        docPillVariant: "secondary" as const,
        gapCount: 0,
        gapPillVariant: "default" as const,
      };
    }
    const missing = c.docs.filter((d) => d.status === "miss").length;
    const openFindings = c.gap_findings.filter((f) => !isGapWorkflowClosed(c.gap_workflow?.[f.rule]));
    const highGaps = openFindings.filter((f) => f.sev === "high").length;
    const criticalGaps = openFindings.filter((f) => f.sev === "critical").length;
    const gapCount = openFindings.length;
    return {
      docCountText: missing ? `${c.docs.length} • ${missing} missing` : `${c.docs.length}`,
      docPillVariant: missing ? ("destructive" as const) : ("secondary" as const),
      gapCount,
      gapPillVariant:
        criticalGaps > 0 ? ("destructive" as const) : highGaps > 3 ? ("accent" as const) : highGaps > 0 ? ("secondary" as const) : ("default" as const),
    };
  }, [c]);

  const gapFindingsFiltered = useMemo(() => {
    if (!c) return [];
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
  }, [c, gapFilter]);

  const catOptions = useMemo(() => {
    if (!c) return [];
    const set = new Set(c.gap_findings.map((f) => f.cat));
    return Array.from(set).sort();
  }, [c]);

  const workflowSteps = useMemo(() => {
    if (!c) {
      return [
        { n: 1, l: "Upload", s: "active" as const },
        { n: 2, l: "Parse", s: "idle" as const },
        { n: 3, l: "Normalize", s: "idle" as const },
        { n: 4, l: "Gap Review", s: "idle" as const },
        { n: 5, l: "Quote", s: "idle" as const },
        { n: 6, l: "Submit", s: "idle" as const },
        { n: 7, l: "Outcome", s: "idle" as const },
      ] as const;
    }
    return [
      { n: 1, l: "Upload", s: "done" as const },
      { n: 2, l: "Parse", s: "done" as const },
      { n: 3, l: "Normalize", s: "done" as const },
      { n: 4, l: "Gap Review", s: "done" as const },
      { n: 5, l: "Quote", s: c.risk_score < 40 ? ("active" as const) : ("idle" as const) },
      { n: 6, l: "Submit", s: "idle" as const },
      { n: 7, l: "Outcome", s: "idle" as const },
    ] as const;
  }, [c]);

  const notes = useMemo(() => {
    if (!c) return [];
    const items: { title: string; body: string; severity: "low" | "medium" | "high" | "critical" }[] = [];
    const open = c.gap_findings.filter((f) => !isGapWorkflowClosed(c.gap_workflow?.[f.rule]));
    for (const g of open.slice(0, 6)) {
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
  }, [c]);

  const totalDocCount = c?.docs.length ?? 0;
  const missingDocPct =
    totalDocCount > 0 ? clampPct(((totalDocCount - docMissingCount) / totalDocCount) * 100) : 0;
  const openHighGaps =
    c?.gap_findings.filter((f) => f.sev === "high" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule])).length ?? 0;
  const openMedGaps =
    c?.gap_findings.filter((f) => f.sev === "medium" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule])).length ?? 0;
  const openCritGaps =
    c?.gap_findings.filter((f) => f.sev === "critical" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule])).length ?? 0;
  const openLowGaps =
    c?.gap_findings.filter((f) => f.sev === "low" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule])).length ?? 0;

  const parsedDocCount = (c?.docs.length ?? 0) - docMissingCount;
  const completenessPctRounded = Math.round(missingDocPct);
  const completenessTone = missingDocPct >= 85 ? "good" : missingDocPct >= 60 ? "warn" : "bad";

  const rulesTriggered = c?.triggered_rules.length ?? 0;
  const rulesTriggeredPct = Math.round((rulesTriggered / 28) * 100);

  function toggleExpanded(rule: string) {
    setExpandedRule((prev) => ({ ...prev, [rule]: !prev[rule] }));
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
            {c?.rfq_num ?? "—"}
          </div>
          <div className="ml-1 flex-1 min-w-0 overflow-hidden">
            <div className="text-sm font-semibold truncate">
              {c ? `${c.title} — ${c.customer}` : "No RFQ loaded"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <ThemeToggle />
              <SettingsMenu />
            </div>
            <div className="flex sm:hidden">
              <SettingsMenu />
            </div>
            <div className="hidden sm:block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Risk Score
            </div>
            <div className="px-3 py-1.5 rounded-xl border bg-background/30 backdrop-blur-sm font-mono text-xs font-semibold border-border">
              {c ? (
                <span
                  className={`inline-flex items-center rounded-lg px-2.5 py-0.5 border leading-none ${riskBadgeClasses(c.risk_score)}`}
                >
                  {c.risk_score}/100
                </span>
              ) : (
                <span className="text-muted-foreground px-2">—</span>
              )}
            </div>
            <Badge
              className={[
                "border",
                c ? statusBadgeClasses(c) : "text-muted-foreground",
                "bg-background/30 backdrop-blur-sm",
              ].join(" ")}
              variant="outline"
            >
              {c?.status_label ?? "Idle"}
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
              RFQ files
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
              {pipelineBusy ? (
                <div
                  className={[
                    "rounded-2xl border border-border bg-card/60 p-4 text-[12px] text-muted-foreground",
                    sidebarOpen ? "" : "px-2 py-3 text-center",
                  ].join(" ")}
                >
                  {sidebarOpen ? "Running parse → gap review…" : "…"}
                </div>
              ) : null}

              <div className="space-y-2">
                {uploadedRfqs.map((u) => {
                  const drivesDashboard = session?.file.id === u.id;
                  const status = analysisStatus[u.id];
                  const inFlight = status?.status === "queued" || status?.status === "analyzing";
                  return (
                    <div
                      key={u.id}
                      className={[
                        "flex rounded-2xl border bg-card/60 shadow-sm overflow-hidden transition",
                        drivesDashboard
                          ? "border-accent/50 ring-1 ring-accent/20"
                          : status?.status === "error"
                            ? "border-red-500/50"
                            : status?.status === "analyzing" || status?.status === "queued"
                              ? "border-cyan-500/45"
                              : "border-border hover:border-accent/35",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        disabled={pipelineBusy || sidebarLoadBusy}
                        onClick={() => void activateRfqFromSidebar(u)}
                        className={[
                          "flex-1 min-w-0 text-left transition",
                          sidebarOpen ? "p-3" : "p-2",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50",
                          pipelineBusy || sidebarLoadBusy ? "opacity-60 cursor-wait" : "cursor-pointer hover:bg-card/80",
                        ].join(" ")}
                        aria-label={`Open RFQ ${u.originalName}`}
                        aria-current={drivesDashboard ? "true" : undefined}
                      >
                        <div className="flex min-w-0 gap-2">
                          <div
                            className={[
                              "w-2.5 h-2.5 rounded-full shrink-0 mt-1.5",
                              drivesDashboard
                                ? "bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.35)]"
                                : status?.status === "error"
                                  ? "bg-red-500"
                                  : inFlight
                                    ? "bg-cyan-400 animate-pulse"
                                    : status?.status === "done"
                                      ? "bg-emerald-400"
                                      : "bg-muted-foreground/35",
                            ].join(" ")}
                          />
                          {sidebarOpen ? (
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                                {drivesDashboard ? "Driving dashboard" : "Open"}
                              </div>
                              <div
                                className="text-[11px] font-semibold leading-tight break-words"
                                title={u.originalName}
                              >
                                {u.originalName}
                              </div>
                              {drivesDashboard && session ? (
                                <div className="text-[10px] font-mono text-muted-foreground">
                                  {sidebarCustomerLabel(session.caseData.customer)} /{" "}
                                  {sidebarProgramLabel(session.caseData.program)}
                                </div>
                              ) : null}
                              {status ? (
                                <SidebarStatusPill status={status.status} message={status.message} />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </button>
                      {sidebarOpen ? (
                        <button
                          type="button"
                          className={[
                            "shrink-0 px-2 border-l border-border/80 text-destructive hover:bg-destructive/10",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-destructive/40",
                            pipelineBusy || sidebarLoadBusy ? "opacity-50 cursor-not-allowed" : "",
                          ].join(" ")}
                          disabled={pipelineBusy || sidebarLoadBusy}
                          aria-label={`Delete ${u.originalName} from list and database`}
                          title="Remove from list and delete saved analysis"
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeRfqFromSidebar(u);
                          }}
                        >
                          <Trash2 className="size-3.5 mx-auto" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className={[
              "shrink-0 border-t border-border bg-secondary/15",
              sidebarOpen ? "p-2" : "p-1.5 flex justify-center",
            ].join(" ")}
          >
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className={[
                "shadow-sm hover:bg-destructive/90",
                sidebarOpen ? "w-full justify-center gap-2" : "h-8 w-8 p-0",
              ].join(" ")}
              aria-label="Log out"
              title="Log out"
              onClick={() => {
                clearAuthSession();
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {sidebarOpen ? <span className="text-[12px] font-semibold">Log out</span> : null}
            </Button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {!pipelineBusy ? (
            <nav aria-label="Dashboard sections" className="flex flex-col">
              <SortableRfqTabBar
                tabOrder={tabOrder}
                onTabOrderChange={setTabOrder}
                activeTab={activeTab}
                onTabSelect={setActiveTab}
                docCountText={tabMeta.docCountText}
                docMissingCount={docMissingCount}
                gapCount={tabMeta.gapCount}
                openHighGaps={openHighGaps}
              />
            </nav>
          ) : null}

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {pipelineBusy ? (
              <div className="flex flex-col items-center justify-center min-h-[320px] gap-3 text-muted-foreground text-sm">
                <div className="font-mono text-[12px]">Running analysis pipeline…</div>
                <div className="text-[11px] text-center max-w-sm">
                  Parse → gap review → benchmark
                </div>
              </div>
            ) : activeTab === "catalog" ? (
              <AllRfqsLibrary />
            ) : activeTab === "portfolio" ? (
              <RfqPortfolioPanel
                onOpenRfq={(sessionId) => {
                  const target = uploadedRfqs.find((u) => u.id === sessionId);
                  if (target) {
                    void activateRfqFromSidebar(target);
                    setActiveTab("parts");
                  }
                }}
              />
            ) : !c ? (
              <div className="max-w-xl mx-auto space-y-4 pt-4">
                <Card className="border-border bg-card/50">
                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-base font-semibold">No active session</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 space-y-4 text-sm text-muted-foreground">
                    <p>
                      Open <span className="font-semibold text-foreground/90">All RFQs</span> for saved analyses, choose a
                      file under <span className="font-semibold text-foreground/90">RFQ files</span>, or upload below.
                    </p>
                    {sessionNotice ? (
                      <div
                        className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-amber-900 dark:text-amber-200"
                        role="status"
                      >
                        {sessionNotice}
                      </div>
                    ) : null}
                    <RfqPackageUpload
                      onUploaded={handleUploaded}
                      onAnalyzed={handleAnalyzed}
                      onAnalysisStatusChange={handleAnalysisStatus}
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
            <>
            {activeTab === "overview" && (
              <div className="space-y-4">
                {sessionNotice ? (
                  <div
                    className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] text-amber-900 dark:text-amber-200"
                    role="status"
                  >
                    {sessionNotice}
                  </div>
                ) : null}
                <RfqPackageUpload
                  onUploaded={handleUploaded}
                  onAnalyzed={handleAnalyzed}
                  onAnalysisStatusChange={handleAnalysisStatus}
                />
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

                <OverviewTopReferenceCard
                  caseData={c}
                  onOpenMatches={() => setActiveTab("parts")}
                />

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
                          {c.gap_findings.filter((f) => !isGapWorkflowClosed(c.gap_workflow?.[f.rule])).length} open ·{" "}
                          {c.gap_findings.length} total
                        </div>
                      </div>

                      <div className="font-mono text-3xl font-semibold">
                        {c.gap_findings.filter((f) => !isGapWorkflowClosed(c.gap_workflow?.[f.rule])).length}
                      </div>

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
                  <CardContent className="p-5 pt-0 space-y-3">
                    {supplyDocError ? (
                      <div
                        role="alert"
                        className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
                      >
                        {supplyDocError}
                      </div>
                    ) : null}
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
                          <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold w-[120px]">
                            Supply
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {c.docs.map((d) => {
                          const tagCls = DOC_TYPE_BADGE_CLS[d.type];

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
                                {(() => {
                                  const linked = c.gap_catalog?.filter((g) => g.doc_slot === d.name) ?? [];
                                  if (linked.length === 0) return null;
                                  return (
                                    <div className="text-[10px] font-mono text-muted-foreground/85 mt-1 leading-tight">
                                      Gap link: {linked.map((g) => g.rule).join(", ")}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                <span className={["inline-flex rounded-md border px-2 py-1 text-[10px] font-mono", tagCls].join(" ")}>
                                  {DOC_TYPE_LABEL[d.type]}
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
                              <TableCell className="align-middle">
                                <>
                                  <input
                                    id={`${supplyInputBaseId}-${d.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                                    type="file"
                                    className="sr-only"
                                    accept=".xlsx,.xls"
                                    disabled={supplyDocBusySlot !== null}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      e.target.value = "";
                                      if (f) void handleSupplyMissingDoc(d.name, f);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px]"
                                    disabled={supplyDocBusySlot !== null}
                                    onClick={() => {
                                      const el = document.getElementById(
                                        `${supplyInputBaseId}-${d.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
                                      ) as HTMLInputElement | null;
                                      el?.click();
                                    }}
                                  >
                                    {supplyDocBusySlot === d.name
                                      ? "Uploading…"
                                      : d.status === "ok"
                                        ? "Replace"
                                        : "Upload"}
                                  </Button>
                                </>
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
                <RfqReferenceMatchPanel caseData={c} />

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
                          {c.gap_findings.filter((f) => !isGapWorkflowClosed(c.gap_workflow?.[f.rule])).length} open ·{" "}
                          {c.gap_findings.length} total
                        </div>
                        <Button type="button" variant="outline" size="sm" className="h-8 text-[11px]" onClick={() => setActiveTab("documents")}>
                          Documents & upload
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <SeverityPill
                        sev="critical"
                        count={
                          c.gap_findings.filter(
                            (f) => f.sev === "critical" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule]),
                          ).length
                        }
                        active={gapFilter === "sev-critical"}
                        onClick={() => setGapFilter("sev-critical")}
                      />
                      <SeverityPill
                        sev="high"
                        count={
                          c.gap_findings.filter((f) => f.sev === "high" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule]))
                            .length
                        }
                        active={gapFilter === "sev-high"}
                        onClick={() => setGapFilter("sev-high")}
                      />
                      <SeverityPill
                        sev="medium"
                        count={
                          c.gap_findings.filter(
                            (f) => f.sev === "medium" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule]),
                          ).length
                        }
                        active={gapFilter === "sev-medium"}
                        onClick={() => setGapFilter("sev-medium")}
                      />
                      <SeverityPill
                        sev="low"
                        count={
                          c.gap_findings.filter((f) => f.sev === "low" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule]))
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
                          High (
                          {
                            c.gap_findings.filter(
                              (f) => f.sev === "high" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule]),
                            ).length
                          }
                          )
                        </button>
                      ) : null}
                      {c.gap_findings.some((f) => f.sev === "medium") ? (
                        <button
                          type="button"
                          onClick={() => setGapFilter("sev-medium")}
                          className={filterButtonCls(gapFilter === "sev-medium")}
                        >
                          Medium (
                          {
                            c.gap_findings.filter(
                              (f) => f.sev === "medium" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule]),
                            ).length
                          }
                          )
                        </button>
                      ) : null}
                      {c.gap_findings.some((f) => f.sev === "low") ? (
                        <button
                          type="button"
                          onClick={() => setGapFilter("sev-low")}
                          className={filterButtonCls(gapFilter === "sev-low")}
                        >
                          Low (
                          {
                            c.gap_findings.filter(
                              (f) => f.sev === "low" && !isGapWorkflowClosed(c.gap_workflow?.[f.rule]),
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
                          const wf = c.gap_workflow?.[f.rule] ?? "open";
                          const closed = isGapWorkflowClosed(wf);
                          const supplySlot = gapFindingUploadSlot(c, f) ?? gapRuleSupplySlotLegacy(c, f.rule);
                          const supplySlotDoc = supplySlot ? c.docs.find((d) => d.name === supplySlot) : undefined;
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
                                            if (file) void handleSupplyMissingDoc(supplySlot, file);
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
                                        setSession((prev) => {
                                          if (!prev?.caseData) return prev;
                                          return {
                                            ...prev,
                                            caseData: {
                                              ...prev.caseData,
                                              gap_workflow: { ...prev.caseData.gap_workflow, [f.rule]: v },
                                            },
                                          };
                                        });
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
                            alert("Export is not available in this build.");
                          }}
                        >
                          Export
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
                                {c.completeness === "incomplete"
                                  ? "Quote release is blocked — missing packaging spec and test standard must be resolved first. Benchmark data is reference only."
                                  : "Multiple cost gaps detected across packaging, logistics, and PPAP. Management review may be required before submission."}
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
            </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarStatusPill({
  status,
  message,
}: {
  status: AnalysisStatusKind;
  message?: string;
}) {
  const cls =
    status === "error"
      ? "border-red-500/40 bg-red-500/10 dark:text-red-200 text-red-700"
      : status === "analyzing"
        ? "border-cyan-500/40 bg-cyan-500/10 dark:text-cyan-200 text-cyan-800"
        : status === "queued"
          ? "border-amber-400/40 bg-amber-400/10 dark:text-amber-200 text-amber-800"
          : "border-emerald-400/40 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700";
  const label =
    status === "error"
      ? "Error"
      : status === "analyzing"
        ? "Analyzing…"
        : status === "queued"
          ? "Queued"
          : "Analyzed";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider",
        cls,
      ].join(" ")}
      title={message ?? label}
    >
      {label}
    </span>
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
  const histMatched = c.historical_benchmark.filter((h) => c.quote.hist_match.includes(h.id)).slice(0, 3);
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

