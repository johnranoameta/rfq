"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applySuppliedPackageDoc,
  clearSuppliedPackageDoc,
  finalizeGapDocument,
} from "@/lib/rfq/applySuppliedPackageDoc";
import { gapFindingUploadSlot } from "@/lib/rfq/reconcileGapsWithDocuments";
import { buildCaseDataFromPersisted } from "@/lib/rfq/caseFromPersisted";
import { loadGapSessionCache, restoreGapSessionCaseData, saveGapSessionCache, clearGapSessionCache } from "@/lib/rfq/gapSessionCache";
import { loadWorkspacePrefs, saveWorkspacePrefs } from "@/lib/rfq/workspacePrefsCache";
import { loadSidebarListCache, saveSidebarListCache } from "@/lib/rfq/sidebarListCache";
import type { RfqParseSessionFull } from "@/lib/rfq/sqlite/parseSessions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleHelp, LogOut, Trash2 } from "lucide-react";
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
import "./rfq-assistant.css";
import { AllRfqsLibrary } from "@/components/rfq/AllRfqsLibrary";
import {
  RfqWordExtractWorkspace,
  type ExtractPackageSummary,
} from "@/components/extraction/RfqWordExtractWorkspace";
import { RfqKbInquiryPanel } from "@/components/rfq/RfqKbInquiryPanel";
import { RfqKbMainPanel } from "@/components/rfq/RfqKbMainPanel";
import { RfqPortfolioPanel } from "@/components/rfq/RfqPortfolioPanel";
import {
  RfqAnalysisShell,
  type AnalysisSelection,
  type AnalysisSubMode,
} from "@/components/rfq/RfqAnalysisShell";
import { RfqWorkbookGapsPanel } from "@/components/rfq/RfqWorkbookGapsPanel";
import {
  RfqPackageUpload,
  STORED_NAME_DB_ONLY,
  type AnalysisStatusEvent,
  type AnalysisStatusKind,
  type UploadedPackageFile,
} from "@/components/rfq/RfqPackageUpload";
import { KB_CLASS_COUNT } from "@/lib/rfq/kbCanonicalClasses";
import { partitionKbBuckets, type KbBucket } from "@/lib/rfq/kbBucketPartition";
import type { KbCategoryRow } from "@/lib/rfq/sqlite/kbCategories";
import type { RfqParseSessionRow } from "@/lib/rfq/sqlite/parseSessions";
import type { SeedRfqProjectRow } from "@/lib/rfq/sqlite/seedRfqs";
import {
  DEFAULT_DEMO_UPLOAD,
  getDefaultDemoSession,
  isPreloadedDemoUpload,
} from "@/data/sampleRfqPipeline";
import { isAnalysisSubModuleEnabled, isWorkspaceModuleEnabled } from "@/lib/rfq/workspaceModules";

const showPortfolio = isWorkspaceModuleEnabled("portfolio");
const showQuoteHistory = isAnalysisSubModuleEnabled("quoteHistory");
type WorkspaceMode = "kb" | "inquiry" | "analysis" | "library" | "portfolio";
type KbSubMode = "browse" | "training";
type NewWorkspaceTab = "summary" | "matching" | "coverage" | "gaps" | "reuse" | "documents" | "quote";

type CatalogPayload = {
  upload_analyses?: RfqParseSessionRow[];
  historical_uploads?: { project_id?: string }[];
  seed_projects?: Array<{
    rfq_id: number;
    customer_id?: number;
    customer_name: string;
    program_name: string;
    part_name: string;
    part_number: string;
    process_family: string;
    material_grade: string | null;
    annual_volume: number | null;
    sop_date: string | null;
    rfq_case_code: string | null;
    created_at?: string | null;
    kb_category_slug?: string | null;
  }>;
  kb_categories?: KbCategoryRow[];
  error?: string;
};
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
  if (rule === "RULE_002") {
    const d = c.docs.find((x) => x.type === "test" && x.status === "miss" && x.name.includes("DV_PV"));
    return d?.name ?? null;
  }
  if (rule === "RULE_028") {
    const d = c.docs.find((x) => x.name === "NB-QA-118_Customer_Spec.pdf");
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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("kb");
  const [kbSubMode, setKbSubMode] = useState<KbSubMode>("browse");
  const [analysisSubMode, setAnalysisSubMode] = useState<AnalysisSubMode>("summary");
  const [analysisSelection, setAnalysisSelection] = useState<AnalysisSelection | null>(null);
  const [extractPackages, setExtractPackages] = useState<ExtractPackageSummary[]>([]);
  const [selectedExtractKey, setSelectedExtractKey] = useState<string | null>(null);
  const [newWsTab, setNewWsTab] = useState<NewWorkspaceTab>("summary");
  const [kbSelectedSlug, setKbSelectedSlug] = useState<string | null>(null);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [gapFilter, setGapFilter] = useState<GapFilterKey>("all");
  /** KB class filter in Analysis → Gap analysis (sidebar); stays in Analysis, does not open Knowledge Base. */
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
  const demoSeededRef = useRef(false);
  /** Blocks prefs/cache writes until startup restore finishes. */
  const initialHydrationDoneRef = useRef(false);
  /** Avoid re-fetch loops when stored analysis is missing. */
  const sessionEnsureKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (!showPortfolio && workspaceMode === "portfolio") {
      setWorkspaceMode("library");
    }
  }, [workspaceMode]);

  const selectAnalysisWord = useCallback(
    (key: string) => {
      const pkg = extractPackages.find((p) => p.key === key);
      if (!pkg) return;
      setWorkspaceMode("analysis");
      setSelectedExtractKey(key);
      setAnalysisSelection({ kind: "word", packageKey: key, label: pkg.filename });
    },
    [extractPackages],
  );

  const openDemoWorkbookAnalysis = useCallback((subMode: AnalysisSubMode = "summary") => {
    sessionEnsureKeyRef.current = null;
    setWorkspaceMode("analysis");
    setAnalysisSubMode(subMode);
    setAnalysisSelection({
      kind: "workbook",
      fileId: DEFAULT_DEMO_UPLOAD.id,
      label: DEFAULT_DEMO_UPLOAD.originalName,
    });
    setUploadedRfqs((prev) => {
      if (prev.some((x) => x.id === DEFAULT_DEMO_UPLOAD.id)) return prev;
      return [DEFAULT_DEMO_UPLOAD, ...prev];
    });
    const defaultSession = getDefaultDemoSession();
    setSession({
      file: defaultSession.file,
      caseData: restoreGapSessionCaseData(DEFAULT_DEMO_UPLOAD.id, defaultSession.caseData),
    });
    setSessionNotice(null);
    setSidebarLoadBusy(false);
    setPipelineBusy(false);
    setGapFilter("all");
    setExpandedRule({});
  }, []);

  const selectAnalysisWorkbook = useCallback(
    (id: string) => {
      sessionEnsureKeyRef.current = null;
      if (id === DEFAULT_DEMO_UPLOAD.id) {
        openDemoWorkbookAnalysis(analysisSubMode);
        return;
      }
      const u = uploadedRfqs.find((x) => x.id === id);
      if (!u) return;
      setWorkspaceMode("analysis");
      setAnalysisSelection({ kind: "workbook", fileId: id, label: u.originalName });
      void activateRfqFromSidebar(u);
    },
    [uploadedRfqs, analysisSubMode, openDemoWorkbookAnalysis],
  );

  const analysisWordOptions = useMemo(
    () =>
      extractPackages.map((p) => ({
        key: p.key,
        label: p.filename,
        detail: `${p.section_count} sections`,
      })),
    [extractPackages],
  );

  const analysisWorkbookOptions = useMemo(() => {
    const userWorkbooks = uploadedRfqs
      .filter((u) => !isPreloadedDemoUpload(u))
      .map((u) => ({
        id: u.id,
        label: u.originalName,
        isDemo: false as const,
      }));
    return [
      {
        id: DEFAULT_DEMO_UPLOAD.id,
        label: DEFAULT_DEMO_UPLOAD.originalName,
        isDemo: true as const,
      },
      ...userWorkbooks,
    ];
  }, [uploadedRfqs]);

  const userWorkbookUploads = useMemo(
    () => uploadedRfqs.filter((u) => !isPreloadedDemoUpload(u)),
    [uploadedRfqs],
  );

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
      const label = file.name;
      let handledDemo = false;
      let nextRisk: number | null = null;

      setSession((prev) => {
        if (!prev?.caseData?.gap_catalog?.length) return prev;
        handledDemo = true;
        const nextCase = applySuppliedPackageDoc(prev.caseData, slotName, label);
        nextRisk = nextCase.risk_score;
        return { ...prev, caseData: nextCase };
      });

      if (handledDemo) {
        if (nextRisk != null) {
          showRaToast(`Document applied — risk score now ${nextRisk}`);
        }
        return;
      }

      const body = new FormData();
      body.set("file", file);
      body.set("purpose", "gap-doc");
      const res = await fetch("/api/rfq/upload", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string; originalName?: string };
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      const uploadedLabel = data.originalName || label;
      setSession((prev) => {
        if (!prev?.caseData) return prev;
        return {
          ...prev,
          caseData: applySuppliedPackageDoc(prev.caseData, slotName, uploadedLabel),
        };
      });
    } catch (e) {
      setSupplyDocError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSupplyDocBusySlot(null);
    }
  }, []);

  const handleRemoveSuppliedDoc = useCallback((slotName: string, rule?: string) => {
    setSupplyDocError(null);
    setSession((prev) => {
      if (!prev?.caseData) return prev;
      return { ...prev, caseData: clearSuppliedPackageDoc(prev.caseData, slotName, rule) };
    });
  }, []);

  const handleFinalizeGapDoc = useCallback((slotName: string, rule: string) => {
    setSupplyDocError(null);
    let nextRisk: number | null = null;
    setSession((prev) => {
      if (!prev?.caseData) return prev;
      const nextCase = finalizeGapDocument(prev.caseData, slotName, rule);
      nextRisk = nextCase.risk_score;
      return { ...prev, caseData: nextCase };
    });
    return nextRisk;
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
        const data = (await r.json()) as CatalogPayload;
        if (r.ok) setCatalog(data);
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

  useEffect(() => {
    if (!sidebarHydrated || !session?.caseData) return;
    saveGapSessionCache(session.file.id, session.caseData);
  }, [session, sidebarHydrated]);

  /**
   * On refresh: restore workspace prefs first (do not persist until hydration completes).
   */
  useEffect(() => {
    if (!sidebarHydrated || demoSeededRef.current) return;
    demoSeededRef.current = true;

    const prefs = loadWorkspacePrefs();
    if (prefs) {
      setWorkspaceMode(prefs.workspaceMode);
      const subMode =
        prefs.analysisSubMode === "quote" && !showQuoteHistory ? "summary" : prefs.analysisSubMode;
      setAnalysisSubMode(subMode);
      if (prefs.analysisSelection) setAnalysisSelection(prefs.analysisSelection);
    } else if (!uploadedRfqs.some((u) => !isPreloadedDemoUpload(u))) {
      setWorkspaceMode("analysis");
      setAnalysisSubMode("summary");
      setAnalysisSelection({
        kind: "workbook",
        fileId: DEFAULT_DEMO_UPLOAD.id,
        label: DEFAULT_DEMO_UPLOAD.originalName,
      });
    }

    initialHydrationDoneRef.current = true;
  }, [sidebarHydrated, uploadedRfqs]);

  useEffect(() => {
    if (!sidebarHydrated || !initialHydrationDoneRef.current) return;
    saveWorkspacePrefs({ workspaceMode, analysisSubMode, analysisSelection });
  }, [workspaceMode, analysisSubMode, analysisSelection, sidebarHydrated]);

  useEffect(() => {
    if (showQuoteHistory || analysisSubMode !== "quote") return;
    setAnalysisSubMode("summary");
  }, [analysisSubMode]);

  const c = session?.caseData ?? null;

  async function activateRfqFromSidebar(u: UploadedPackageFile) {
    if (pipelineBusy || sidebarLoadBusy) return;
    if (isPreloadedDemoUpload(u)) {
      openDemoWorkbookAnalysis(analysisSubMode);
      return;
    }
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
        setSession({
          file: fileDb,
          caseData: restoreGapSessionCaseData(u.id, buildCaseDataFromPersisted(row, fileDb)),
        });
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
      const cached = loadGapSessionCache(u.id);
      if (cached) {
        setSession({ file: u, caseData: cached });
        setSessionNotice(null);
      }
    } catch {
      setSessionNotice("Network error loading stored RFQ.");
      const cached = loadGapSessionCache(u.id);
      if (cached) {
        setSession({ file: u, caseData: cached });
        setSessionNotice(null);
      }
    } finally {
      setSidebarLoadBusy(false);
    }
  }

  async function removeRfqFromSidebar(u: UploadedPackageFile) {
    const isDemo = isPreloadedDemoUpload(u);
    const msg = isDemo
      ? `Remove the preloaded demo (“${u.originalName}”) from this list?`
      : `Remove “${u.originalName}” from this list and delete its saved analysis from the database?`;
    if (!window.confirm(msg)) return;

    if (!isDemo) {
      setSidebarLoadBusy(true);
      try {
        await fetch(`/api/rfq/database/sessions/${encodeURIComponent(u.id)}`, { method: "DELETE" });
      } catch {
        /* still drop from sidebar */
      } finally {
        setSidebarLoadBusy(false);
      }
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
    clearGapSessionCache(u.id);
    void (async () => {
      try {
        const r = await fetch("/api/rfq/database/catalog", { cache: "no-store" });
        const data = (await r.json()) as CatalogPayload;
        if (r.ok) setCatalog(data);
      } catch {
        /* ignore */
      }
    })();
  }

  function handleUploaded(file: UploadedPackageFile) {
    setUploadedRfqs((prev) => {
      if (prev.some((u) => u.id === file.id)) return prev;
      return [file, ...prev];
    });
    if (workspaceMode !== "analysis") {
      setSessionNotice(`Stored “${file.originalName}”. Analysis runs only for the 4-sheet workbook format.`);
    } else {
      setSessionNotice(null);
    }
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
    const inAnalysisWorkspace = workspaceMode === "analysis";
    if (!hasActiveSession || inAnalysisWorkspace) {
      setSessionNotice(null);
      setWorkspaceMode("analysis");
      setAnalysisSubMode("summary");
      setAnalysisSelection({ kind: "workbook", fileId: file.id, label: file.originalName });
      await activateRfqFromSidebar(file);
    } else if (session.file.id !== file.id) {
      setSessionNotice(
        `Analyzed “${file.originalName}”. Open it from the sidebar when ready.`,
      );
    }
    void (async () => {
      try {
        const r = await fetch("/api/rfq/database/catalog", { cache: "no-store" });
        const data = (await r.json()) as CatalogPayload;
        if (r.ok) setCatalog(data);
      } catch {
        /* ignore */
      }
    })();
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

  const kbClassBuckets = useMemo((): KbBucket[] => {
    const cats = catalog?.kb_categories ?? [];
    if (cats.length === 0) return [];
    return partitionKbBuckets(
      cats,
      (catalog?.seed_projects ?? []) as SeedRfqProjectRow[],
      catalog?.upload_analyses ?? [],
    );
  }, [catalog?.kb_categories, catalog?.seed_projects, catalog?.upload_analyses]);

  useEffect(() => {
    if (workspaceMode !== "kb" || kbSubMode !== "browse") return;
    const valid = kbSelectedSlug && kbClassBuckets.some((b) => b.slug === kbSelectedSlug);
    if (valid) return;
    const firstWithData = kbClassBuckets.find((b) => b.projects.length > 0);
    setKbSelectedSlug(firstWithData?.slug ?? kbClassBuckets[0]?.slug ?? null);
  }, [workspaceMode, kbSubMode, kbClassBuckets, kbSelectedSlug]);

  const isKbTraining = workspaceMode === "kb" && kbSubMode === "training";
  const isAnalysis = workspaceMode === "analysis";

  /** Load workbook caseData whenever Analysis points at a workbook but session is empty. */
  useEffect(() => {
    if (!sidebarHydrated || !initialHydrationDoneRef.current) return;
    if (!isAnalysis || sidebarLoadBusy || pipelineBusy) return;

    const sel = analysisSelection;
    if (sel?.kind !== "workbook") return;
    if (session?.file.id === sel.fileId && session.caseData) return;

    const ensureKey = sel.fileId;
    if (sessionEnsureKeyRef.current === ensureKey) {
      const cached = loadGapSessionCache(sel.fileId);
      if (cached) {
        const file =
          uploadedRfqs.find((u) => u.id === sel.fileId) ??
          (sel.fileId === DEFAULT_DEMO_UPLOAD.id
            ? DEFAULT_DEMO_UPLOAD
            : {
                id: sel.fileId,
                originalName: sel.label,
                size: 0,
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                storedName: STORED_NAME_DB_ONLY,
              });
        setSession({ file, caseData: cached });
      }
      return;
    }
    sessionEnsureKeyRef.current = ensureKey;

    if (sel.fileId === DEFAULT_DEMO_UPLOAD.id) {
      openDemoWorkbookAnalysis(analysisSubMode);
      return;
    }

    const u = uploadedRfqs.find((x) => x.id === sel.fileId);
    if (u) {
      void activateRfqFromSidebar(u);
    }
  }, [
    sidebarHydrated,
    isAnalysis,
    analysisSelection,
    analysisSubMode,
    session?.file.id,
    session?.caseData,
    sidebarLoadBusy,
    pipelineBusy,
    uploadedRfqs,
    openDemoWorkbookAnalysis,
  ]);

  const analysisSelectionResolved = useMemo((): AnalysisSelection | null => {
    if (analysisSelection) return analysisSelection;
    if (isAnalysis && selectedExtractKey) {
      const pkg = extractPackages.find((p) => p.key === selectedExtractKey);
      if (pkg) {
        return { kind: "word", packageKey: pkg.key, label: pkg.filename };
      }
    }
    if (isAnalysis && session?.file) {
      return {
        kind: "workbook",
        fileId: session.file.id,
        label: session.file.originalName,
      };
    }
    return null;
  }, [analysisSelection, isAnalysis, selectedExtractKey, extractPackages, session?.file]);

  const loadExtractPackages = useCallback(async () => {
    try {
      const res = await fetch("/api/extraction/manifest", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { packages: ExtractPackageSummary[] };
      const list = data.packages ?? [];
      setExtractPackages(list);
      setSelectedExtractKey((prev) => {
        if (prev && list.some((p) => p.key === prev)) return prev;
        return list[0]?.key ?? null;
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadExtractPackages();
  }, [loadExtractPackages]);

  async function removeExtractPackage(p: ExtractPackageSummary) {
    const msg = `Remove “${p.filename}” and delete its extracted data?`;
    if (!window.confirm(msg)) return;

    try {
      const res = await fetch(`/api/extraction/package?package=${encodeURIComponent(p.key)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string; packages?: ExtractPackageSummary[] };
      if (!res.ok) throw new Error(data.error || `Delete failed (${res.status})`);
      const list = data.packages ?? [];
      setExtractPackages(list);
      setSelectedExtractKey((prev) => {
        if (prev && list.some((x) => x.key === prev)) return prev;
        return list[0]?.key ?? null;
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const selectedExtractPackage = useMemo(
    () => extractPackages.find((p) => p.key === selectedExtractKey) ?? null,
    [extractPackages, selectedExtractKey],
  );

  const headerKbClassCount = catalog?.kb_categories?.length ?? KB_CLASS_COUNT;
  const headerHistoricalCount =
    (catalog?.seed_projects?.length ?? 0) +
    (catalog?.historical_uploads?.length ?? 0);
  const headerSavedAnalysesCount = catalog?.upload_analyses?.length ?? 0;
  const headerNewCount = extractPackages.length + uploadedRfqs.length;

  const kbBucketSelected = useMemo(() => {
    if (!kbSelectedSlug) return null;
    return kbClassBuckets.find((b) => b.slug === kbSelectedSlug) ?? null;
  }, [kbClassBuckets, kbSelectedSlug]);

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

  function showRaToast(msg: string) {
    const el = document.createElement("div");
    el.className =
      "fixed bottom-5 right-5 z-[200] rounded-lg px-4 py-2 text-[13px] text-white shadow-lg";
    el.style.background = "#0f2340";
    el.textContent = msg;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2200);
  }

  const workbookGapsPanel = useMemo(() => {
    if (!c || analysisSelectionResolved?.kind !== "workbook") return null;



    return (
      <RfqWorkbookGapsPanel
        caseData={c}
        gapFilter={gapFilter}
        setGapFilter={setGapFilter}
        expandedRule={expandedRule}
        toggleExpanded={toggleExpanded}
        gapFindingsFiltered={gapFindingsFiltered}
        supplyDocError={supplyDocError}
        supplyDocBusySlot={supplyDocBusySlot}
        onSupplyMissingDoc={handleSupplyMissingDoc}
        onRemoveSuppliedDoc={(slotName, rule) => {
          handleRemoveSuppliedDoc(slotName, rule);
          showRaToast("Upload removed — gap reopened");
        }}
        onFinalizeGapDoc={(slotName, rule) => {
          const nextRisk = handleFinalizeGapDoc(slotName, rule);
          showRaToast(
            nextRisk != null
              ? `Document finalized — risk score now ${nextRisk}`
              : "Document finalized for this gap",
          );
        }}
        onWorkflowChange={(rule, status) => {
          setSession((prev) => {
            if (!prev?.caseData) return prev;
            return {
              ...prev,
              caseData: {
                ...prev.caseData,
                gap_workflow: { ...prev.caseData.gap_workflow, [rule]: status },
              },
            };
          });
        }}
        onOpenDocuments={() => setWorkspaceMode("library")}
      />
    );
  }, [
    c,
    analysisSelectionResolved,
    gapFilter,
    expandedRule,
    gapFindingsFiltered,
    supplyDocError,
    supplyDocBusySlot,
    handleSupplyMissingDoc,
    handleRemoveSuppliedDoc,
    handleFinalizeGapDoc,
  ]);

  function rfqSidebarStatusDot(u: UploadedPackageFile): string {
    const drivesDashboard = session?.file.id === u.id;
    const status = analysisStatus[u.id];
    const inFlight = status?.status === "queued" || status?.status === "analyzing";
    if (drivesDashboard) return "dot-amber";
    if (status?.status === "error") return "dot-red";
    if (inFlight) return "dot-blue";
    if (status?.status === "done") return "dot-green";
    return "dot-blue opacity-50";
  }

  return (
    <div
      className={["rfq-assistant rfq-assistant-app", sidebarOpen ? "" : "collapsed"].join(" ")}
      style={{ fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif" }}
    >
      <header className="ra-header">
        <div className="ra-header-brand">
          <div className="ra-brand-logo">R</div>
          <div className="ra-brand-text">
            <div className="ra-brand-title">RFQ Assistant</div>
            <div className="ra-brand-sub">Procurement Intelligence</div>
          </div>
        </div>
        <div className="ra-header-pills min-w-0">
          <span className="ra-hpill">
            <strong>{headerKbClassCount}</strong>
          </span>
          <span className="ra-hpill">
            <strong>{headerHistoricalCount}</strong>
          </span>
          <span className="ra-hpill">
            <strong>{headerNewCount}</strong>
          </span>
          {selectedExtractPackage && isKbTraining ? (
            <span className="ra-hpill hidden xl:inline">
              <strong>{selectedExtractPackage.rfq_number ?? selectedExtractPackage.filename}</strong>
              {selectedExtractPackage.section_count > 0
                ? ` · ${selectedExtractPackage.section_count} sections`
                : ""}
            </span>
          ) : null}
        </div>
        <div className="ra-header-actions">
          <Link href="/baseline" className="ra-hbtn hidden lg:inline-flex">
            Baseline object
          </Link>
          <Link
            href="/help"
            className="ra-hbtn inline-flex items-center justify-center gap-1.5 px-2.5 py-2 min-w-9"
            aria-label="Open user guide in a new tab"
            target="_blank"
            rel="noopener noreferrer"
          >
            <CircleHelp className="size-[18px] shrink-0" aria-hidden />
            <span className="text-[11px] sm:text-[12px] font-medium whitespace-nowrap">Guide</span>
          </Link>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <button
            type="button"
            className="ra-hbtn"
            onClick={() => {
              setWorkspaceMode("kb");
              setKbSubMode("browse");
            }}
          >
            Knowledge base
          </button>
          <button
            type="button"
            className={["ra-hbtn", workspaceMode === "inquiry" ? "ra-hbtn-primary" : ""].join(" ")}
            onClick={() => setWorkspaceMode("inquiry")}
          >
            Chat
          </button>
          <SettingsMenu />
        </div>
      </header>

      <div className="rfq-assistant-body">
        <aside className="ra-sidebar">
          <button
            type="button"
            className="ra-sidebar-toggle"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ‹
          </button>

          <div className="ra-sidebar-section">
            <div className="ra-sidebar-label">Workspace</div>
            <button
              type="button"
              className={["ra-nav-item ra-nav-item-btn", workspaceMode === "kb" || workspaceMode === "inquiry" ? "active" : ""].join(" ")}
              onClick={() => {
                setWorkspaceMode("kb");
                setKbSubMode("browse");
              }}
            >
              <span className="ra-nav-text">Knowledge Base</span>
              <span className="ra-nav-badge">{headerHistoricalCount + headerNewCount}</span>
            </button>
            {(workspaceMode === "kb" || workspaceMode === "inquiry") && sidebarOpen ? (
              <div className="ra-nav-submenu" role="group" aria-label="Knowledge base sections">
                <button
                  type="button"
                  className={["ra-nav-subitem", workspaceMode === "kb" && kbSubMode === "browse" ? "active" : ""].join(" ")}
                  onClick={() => {
                    setWorkspaceMode("kb");
                    setKbSubMode("browse");
                  }}
                >
                  <span className="ra-nav-text">Historical</span>
                  <span className="ra-nav-badge">{headerHistoricalCount}</span>
                </button>
                <button
                  type="button"
                  className={["ra-nav-subitem", workspaceMode === "kb" && kbSubMode === "training" ? "active" : ""].join(" ")}
                  onClick={() => {
                    setWorkspaceMode("kb");
                    setKbSubMode("training");
                  }}
                >
                  <span className="ra-nav-text">In Progress</span>
                  <span className="ra-nav-badge ra-nav-badge-warn">{headerNewCount}</span>
                </button>
                <button
                  type="button"
                  className={["ra-nav-subitem", workspaceMode === "inquiry" ? "active" : ""].join(" ")}
                  onClick={() => setWorkspaceMode("inquiry")}
                >
                  <span className="ra-nav-text">Inquiry (Chat)</span>
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className={["ra-nav-item ra-nav-item-btn", workspaceMode === "analysis" ? "active" : ""].join(" ")}
              onClick={() => {
                setWorkspaceMode("analysis");
                setAnalysisSubMode("matching");
              }}
            >
              <span className="ra-nav-text">Analysis</span>
              <span className="ra-nav-badge">{extractPackages.length + uploadedRfqs.length}</span>
            </button>
            {workspaceMode === "analysis" && sidebarOpen ? (
              <div className="ra-nav-submenu" role="group" aria-label="Analysis sections">
                <button
                  type="button"
                  className={["ra-nav-subitem", analysisSubMode === "summary" ? "active" : ""].join(" ")}
                  onClick={() => {
                    setWorkspaceMode("analysis");
                    setAnalysisSubMode("summary");
                  }}
                >
                  <span className="ra-nav-text">Overview</span>
                </button>
                <button
                  type="button"
                  className={["ra-nav-subitem", analysisSubMode === "matching" ? "active" : ""].join(" ")}
                  onClick={() => {
                    setWorkspaceMode("analysis");
                    setAnalysisSubMode("matching");
                  }}
                >
                  <span className="ra-nav-text">Matching</span>
                </button>
                <button
                  type="button"
                  className={["ra-nav-subitem", analysisSubMode === "coverage" ? "active" : ""].join(" ")}
                  onClick={() => {
                    setWorkspaceMode("analysis");
                    setAnalysisSubMode("coverage");
                  }}
                >
                  <span className="ra-nav-text">Coverage</span>
                </button>
                <button
                  type="button"
                  className={["ra-nav-subitem", analysisSubMode === "gaps" ? "active" : ""].join(" ")}
                  onClick={() => {
                    setWorkspaceMode("analysis");
                    setAnalysisSubMode("gaps");
                  }}
                >
                  <span className="ra-nav-text">Gap analysis</span>
                </button>
                <button
                  type="button"
                  className={["ra-nav-subitem", analysisSubMode === "reuse" ? "active" : ""].join(" ")}
                  onClick={() => {
                    setWorkspaceMode("analysis");
                    setAnalysisSubMode("reuse");
                  }}
                >
                  <span className="ra-nav-text">Reuse guidance</span>
                </button>
                {showQuoteHistory ? (
                  <button
                    type="button"
                    className={["ra-nav-subitem", analysisSubMode === "quote" ? "active" : ""].join(" ")}
                    onClick={() => {
                      setWorkspaceMode("analysis");
                      setAnalysisSubMode("quote");
                    }}
                  >
                    <span className="ra-nav-text">Quote &amp; history</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className={["ra-nav-item ra-nav-item-btn", workspaceMode === "library" ? "active" : ""].join(" ")}
              onClick={() => setWorkspaceMode("library")}
            >
              <span className="ra-nav-text">Saved analyses</span>
              <span className="ra-nav-badge">{headerSavedAnalysesCount}</span>
            </button>
            {showPortfolio ? (
              <button
                type="button"
                className={["ra-nav-item ra-nav-item-btn", workspaceMode === "portfolio" ? "active" : ""].join(" ")}
                onClick={() => setWorkspaceMode("portfolio")}
              >
                <span className="ra-nav-text">Portfolio</span>
              </button>
            ) : null}
          </div>

          <div className="ra-divider" />

          <div className="ra-sidebar-search">
            <span className="ra-search-icon" aria-hidden>
              ⌕
            </span>
            <input
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              placeholder={
                workspaceMode === "analysis" && analysisSubMode === "gaps"
                  ? "Filter classes…"
                  : workspaceMode === "analysis"
                    ? "Filter RFQs…"
                    : "Search…"
              }
              aria-label="Filter sidebar"
            />
          </div>

          <div className="ra-sidebar-scroll">
            {pipelineBusy ? (
              <div className="text-[12px] text-[var(--ra-muted)] px-1 py-2">
                {sidebarOpen ? "Running parse → gap review…" : "…"}
              </div>
            ) : workspaceMode === "kb" && kbSubMode === "browse" ? (
              kbClassBuckets
                .filter((b) => {
                  const q = sidebarQuery.trim().toLowerCase();
                  if (!q) return true;
                  if (b.label.toLowerCase().includes(q)) return true;
                  return b.projects.some(
                    (p) =>
                      p.part_name.toLowerCase().includes(q) ||
                      p.program_name.toLowerCase().includes(q) ||
                      p.part_number.toLowerCase().includes(q),
                  );
                })
                .map((b) => {
                  const active = kbSelectedSlug === b.slug;
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      className={["ra-kb-item ra-nav-item-btn", active ? "active" : ""].join(" ")}
                      onClick={() => setKbSelectedSlug(b.slug)}
                    >
                      <div
                        className="ra-kb-icon"
                        style={{
                          background: b.icon_bg,
                          color: b.icon_fg,
                        }}
                      >
                        {b.letter}
                      </div>
                      {sidebarOpen ? (
                        <div className="min-w-0 flex-1 text-left">
                          <div className="ra-kb-name">{b.label}</div>
                          <div className="ra-kb-count">
                            {b.projects.length} RFQ{b.projects.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      ) : null}
                    </button>
                  );
                })
            ) : workspaceMode === "kb" && kbSubMode === "training" ? (
              extractPackages.length === 0 && uploadedRfqs.length === 0 ? (
                <div
                  className={[
                    "text-[12px] text-[var(--ra-muted)] leading-snug",
                    sidebarOpen ? "px-2 py-3" : "px-1 py-2 text-center",
                  ].join(" ")}
                >
                  {sidebarOpen
                    ? "No uploads yet. Upload a Word package or workbook in the main panel."
                    : "…"}
                </div>
              ) : (
              <>
                {extractPackages.length > 0 && sidebarOpen ? (
                  <div className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ra-muted)]">
                    Word Packages
                  </div>
                ) : null}
                {extractPackages
                  .filter((p) => {
                    const q = sidebarQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      p.filename.toLowerCase().includes(q) ||
                      (p.rfq_number ?? "").toLowerCase().includes(q) ||
                      (p.title ?? "").toLowerCase().includes(q)
                    );
                  })
                  .map((p) => {
                    const active = selectedExtractKey === p.key;
                    return (
                      <div
                        key={p.key}
                        className="ra-sidebar-package-row flex w-full min-w-0 items-stretch overflow-hidden rounded-[var(--ra-radius)] border border-[var(--ra-border)]"
                      >
                        <button
                          type="button"
                          className={[
                            "rfq-item min-w-0 flex-1 border-0 bg-transparent text-left flex items-center gap-2",
                            active ? "active" : "",
                          ].join(" ")}
                          onClick={() => {
                            setWorkspaceMode("kb");
                            setKbSubMode("training");
                            setSelectedExtractKey(p.key);
                          }}
                        >
                          <div
                            className="ra-kb-icon shrink-0"
                            style={{
                              background: p.has_error ? "var(--ra-red-bg)" : "var(--ra-accent-bg)",
                              color: p.has_error ? "var(--ra-red)" : "var(--ra-accent)",
                            }}
                          >
                            W
                          </div>
                          {sidebarOpen ? (
                            <div className="min-w-0 flex-1">
                              <div className="rfq-item-name truncate">{p.filename}</div>
                              <div className="rfq-item-meta">
                                {p.rfq_number ? `#${p.rfq_number} · ` : ""}
                                {p.section_count} sections · {p.attachment_count} files
                              </div>
                            </div>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="ra-sidebar-delete-btn"
                          aria-label={`Delete ${p.filename}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeExtractPackage(p);
                          }}
                        >
                          <Trash2 className="size-4 shrink-0" aria-hidden />
                        </button>
                      </div>
                    );
                  })}
                {uploadedRfqs.length > 0 && sidebarOpen ? (
                  <div className="px-2 pt-3 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ra-muted)]">
                    Workbook Analyses
                  </div>
                ) : null}
                {uploadedRfqs
                  .filter((u) => {
                    const q = sidebarQuery.trim().toLowerCase();
                    if (!q) return true;
                    return u.originalName.toLowerCase().includes(q);
                  })
                  .map((u) => {
                    const isDemo = u.id === DEFAULT_DEMO_UPLOAD.id;
                    const status = analysisStatus[u.id];
                    return (
                      <button
                        key={`wb-${u.id}`}
                        type="button"
                        className="rfq-item w-full text-left"
                        onClick={() => isDemo ? openDemoWorkbookAnalysis("gaps") : selectAnalysisWorkbook(u.id)}
                      >
                        <span className={`rfq-dot ${isDemo ? "dot-amber" : rfqSidebarStatusDot(u)}`} aria-hidden />
                        {sidebarOpen ? (
                          <div className="min-w-0 flex-1">
                            <div className="rfq-item-name truncate">{u.originalName}</div>
                            <div className="rfq-item-meta flex items-center gap-2 flex-wrap">
                              {isDemo ? (
                                <>
                                  Gap analysis demo
                                  <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                                    Demo
                                  </span>
                                </>
                              ) : (
                                <>
                                  Workbook
                                  {status ? (
                                    <SidebarStatusPill status={status.status} message={status.message} />
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
              </>
              )
            ) : workspaceMode === "inquiry" ? (
              <div
                className={[
                  "text-[12px] text-[var(--ra-muted)] leading-snug",
                  sidebarOpen ? "px-2 py-3" : "px-1 py-2 text-center",
                ].join(" ")}
              >
                {sidebarOpen
                  ? selectedExtractPackage
                    ? `Chat uses all extracted packages; focus: “${selectedExtractPackage.filename}”.`
                    : "Chat compares Word RFQs (RFQ1 vs RFQ2). Upload under In Progress, then ask in the main panel."
                  : "…"}
              </div>
            ) : workspaceMode === "analysis" && analysisSubMode === "gaps" ? (
              <>
                {uploadedRfqs
                  .filter((u) => {
                    const q = sidebarQuery.trim().toLowerCase();
                    if (!q) return true;
                    return u.originalName.toLowerCase().includes(q);
                  })
                  .map((u) => {
                    const active =
                      analysisSelectionResolved?.kind === "workbook" &&
                      analysisSelectionResolved.fileId === u.id;
                    const isDemo = u.id === DEFAULT_DEMO_UPLOAD.id;
                    const status = analysisStatus[u.id];
                    return (
                      <button
                        key={`gap-wb-${u.id}`}
                        type="button"
                        className={["rfq-item w-full text-left", active ? "active" : ""].join(" ")}
                        onClick={() => {
                          if (isDemo) openDemoWorkbookAnalysis("gaps");
                          else selectAnalysisWorkbook(u.id);
                        }}
                      >
                        <span className={`rfq-dot ${isDemo ? "dot-amber" : rfqSidebarStatusDot(u)}`} aria-hidden />
                        {sidebarOpen ? (
                          <div className="min-w-0 flex-1">
                            <div className="rfq-item-name truncate">{u.originalName}</div>
                            <div className="rfq-item-meta flex items-center gap-2 flex-wrap">
                              {isDemo ? (
                                <>
                                  Gap analysis demo
                                  <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                                    Demo
                                  </span>
                                </>
                              ) : (
                                <>
                                  Workbook
                                  {status ? (
                                    <SidebarStatusPill status={status.status} message={status.message} />
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                {sidebarOpen && uploadedRfqs.length === 0 ? (
                  <div className="text-[12px] text-[var(--ra-muted)] px-2 py-3 leading-snug">
                    No workbook analyses yet. Upload a workbook from the main panel.
                  </div>
                ) : null}
              </>
            ) : workspaceMode === "analysis" ? (
              <>
                {sidebarOpen ? (
                  <div className="px-0 pb-2 shrink-0">
                    <p className="text-[11px] text-[var(--ra-muted)] leading-snug px-0.5">
                      <strong className="text-[var(--ra-text)] font-semibold">Switch RFQ</strong> — click a row below.
                    </p>
                  </div>
                ) : null}
                {extractPackages.length === 0 && userWorkbookUploads.length === 0 ? (
                  <div className="text-[12px] text-[var(--ra-muted)] px-2 py-3 leading-snug">
                    {sidebarOpen
                      ? "No other RFQs yet. Open the demo workbook below, or upload under Knowledge Base → In Progress."
                      : "…"}
                  </div>
                ) : null}
                {sidebarOpen ? (
                  <div className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ra-muted)]">
                    Demo workbook
                  </div>
                ) : null}
                <button
                  type="button"
                  className={[
                    "rfq-item w-full text-left",
                    analysisSelectionResolved?.kind === "workbook" &&
                    analysisSelectionResolved.fileId === DEFAULT_DEMO_UPLOAD.id
                      ? "active"
                      : "",
                  ].join(" ")}
                  onClick={() => openDemoWorkbookAnalysis(analysisSubMode)}
                >
                  <span className="rfq-dot dot-amber" aria-hidden />
                  {sidebarOpen ? (
                    <div className="min-w-0 flex-1">
                      <div className="rfq-item-name truncate">{DEFAULT_DEMO_UPLOAD.originalName}</div>
                      <div className="rfq-item-meta flex items-center gap-2 flex-wrap">
                        Gap analysis demo
                        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                          Demo
                        </span>
                      </div>
                    </div>
                  ) : null}
                </button>
                {extractPackages.length > 0 && sidebarOpen ? (
                  <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ra-muted)]">
                    Word packages
                  </div>
                ) : null}
                {extractPackages
                  .filter((p) => {
                    const q = sidebarQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      p.filename.toLowerCase().includes(q) ||
                      (p.rfq_number ?? "").toLowerCase().includes(q) ||
                      (p.title ?? "").toLowerCase().includes(q)
                    );
                  })
                  .map((p) => {
                    const active =
                      analysisSelectionResolved?.kind === "word" && analysisSelectionResolved.packageKey === p.key;
                    return (
                      <button
                        key={`word-${p.key}`}
                        type="button"
                        className={["rfq-item w-full text-left", active ? "active" : ""].join(" ")}
                        onClick={() => selectAnalysisWord(p.key)}
                      >
                        <div
                          className="ra-kb-icon shrink-0"
                          style={{
                            background: p.has_error ? "var(--ra-red-bg)" : "var(--ra-accent-bg)",
                            color: p.has_error ? "var(--ra-red)" : "var(--ra-accent)",
                          }}
                        >
                          W
                        </div>
                        {sidebarOpen ? (
                          <div className="min-w-0 flex-1">
                            <div className="rfq-item-name truncate">{p.filename}</div>
                            <div className="rfq-item-meta">
                              {p.rfq_number ? `#${p.rfq_number} · ` : ""}
                              {p.section_count} sections
                            </div>
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                {userWorkbookUploads.length > 0 && sidebarOpen ? (
                  <div className="px-2 pt-3 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ra-muted)]">
                    Your workbook analyses
                  </div>
                ) : null}
                {userWorkbookUploads
                  .filter((u) => {
                    const q = sidebarQuery.trim().toLowerCase();
                    if (!q) return true;
                    return u.originalName.toLowerCase().includes(q);
                  })
                  .map((u) => {
                    const active =
                      analysisSelectionResolved?.kind === "workbook" &&
                      analysisSelectionResolved.fileId === u.id;
                    const status = analysisStatus[u.id];
                    return (
                      <button
                        key={`wb-${u.id}`}
                        type="button"
                        className={["rfq-item w-full text-left", active ? "active" : ""].join(" ")}
                        onClick={() => selectAnalysisWorkbook(u.id)}
                      >
                        <span className={`rfq-dot ${rfqSidebarStatusDot(u)}`} aria-hidden />
                        {sidebarOpen ? (
                          <div className="min-w-0 flex-1">
                            <div className="rfq-item-name truncate">{u.originalName}</div>
                            <div className="rfq-item-meta flex items-center gap-2 flex-wrap">
                              Workbook
                              {status ? (
                                <SidebarStatusPill status={status.status} message={status.message} />
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
              </>
            ) : (
              <div
                className={[
                  "text-[12px] text-[var(--ra-muted)] leading-snug",
                  sidebarOpen ? "px-2 py-3" : "px-1 py-2 text-center",
                ].join(" ")}
              >
                {sidebarOpen
                  ? showPortfolio
                    ? "Saved analyses and Portfolio apply to your whole workspace. Open Knowledge Base or Analysis from the menu above."
                    : "Saved analyses apply to your whole workspace. Open Knowledge Base or Analysis from the menu above."
                  : "…"}
              </div>
            )}
          </div>

          <div
            className={[
              "shrink-0 border-t border-[var(--ra-border)] bg-[var(--ra-bg)]",
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

        <main className="ra-canvas">
          {pipelineBusy ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[var(--ra-muted)] text-sm">
              <div className="ra-mono text-[12px]">Running analysis pipeline…</div>
              <div className="text-[11px] text-center max-w-sm">Parse → gap review → benchmark</div>
            </div>
          ) : workspaceMode === "inquiry" ? (
            <RfqKbInquiryPanel
              packageId={selectedExtractKey}
              packageLabel={selectedExtractPackage?.filename ?? null}
              sessionId={session?.file.id ?? null}
              sessionLabel={session?.file.originalName ?? null}
            />
          ) : workspaceMode === "kb" && kbSubMode === "browse" ? (
            kbBucketSelected ? (
              <RfqKbMainPanel
                kbBucket={kbBucketSelected}
                projects={kbBucketSelected.projects}
                onOpenPortfolioRfq={() => {
                  setWorkspaceMode("kb");
                  setKbSubMode("training");
                }}
              />
            ) : (
              <div className="ra-canvas-content text-[var(--ra-muted)] text-sm">Loading knowledge base…</div>
            )
          ) : workspaceMode === "library" ? (
            <div className="ra-canvas-content min-h-0 flex flex-col">
              <AllRfqsLibrary />
            </div>
          ) : showPortfolio && workspaceMode === "portfolio" ? (
            <div className="ra-canvas-content min-h-0 flex flex-col">
              <RfqPortfolioPanel
                onOpenRfq={() => {
                  setWorkspaceMode("kb");
                  setKbSubMode("training");
                }}
              />
            </div>
          ) : isKbTraining ? (
            <RfqWordExtractWorkspace
              embedded
              selectedKey={selectedExtractKey}
              onSelectedKeyChange={setSelectedExtractKey}
              onPackagesChange={setExtractPackages}
              onExtractionComplete={(key) => {
                if (key) setSelectedExtractKey(key);
                void loadExtractPackages();
              }}
              onPackageDeleted={() => void loadExtractPackages()}
            />
          ) : isAnalysis ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <RfqAnalysisShell
                subMode={analysisSubMode}
                selection={analysisSelectionResolved}
                caseData={analysisSelectionResolved?.kind === "workbook" ? c : null}
                sessionNotice={sessionNotice}
                loading={sidebarLoadBusy}
                gapsPanel={workbookGapsPanel}
                isDemoWorkbook={
                  analysisSelectionResolved?.kind === "workbook" &&
                  isPreloadedDemoUpload(
                    uploadedRfqs.find((u) => u.id === analysisSelectionResolved.fileId) ?? DEFAULT_DEMO_UPLOAD,
                  )
                }
                onLoadDemo={() => openDemoWorkbookAnalysis("summary")}
                onNavigateSubMode={setAnalysisSubMode}
                workbookUploadSlot={
                  <RfqPackageUpload
                    embedded
                    onUploaded={handleUploaded}
                    onAnalyzed={handleAnalyzed}
                    onAnalysisStatusChange={handleAnalysisStatus}
                  />
                }
              />
            </div>
          ) : (
              <div className="ra-canvas-content text-[var(--ra-muted)] text-sm px-4">
                Select <span className="font-semibold text-[var(--ra-text)]">Knowledge Base → In Progress</span> to upload a
                Word RFQ package, <span className="font-semibold text-[var(--ra-text)]">Inquiry (Chat)</span> to ask
                questions, or <span className="font-semibold text-[var(--ra-text)]">Analysis</span> for matching and gaps.
              </div>
            )}
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

