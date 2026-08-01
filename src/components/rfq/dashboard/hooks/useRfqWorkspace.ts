"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ExtractPackageSummary } from "@/components/extraction/RfqWordExtractWorkspace";
import type { AnalysisSelection, AnalysisSubMode } from "@/components/rfq/RfqAnalysisShell";
import { STORED_NAME_DB_ONLY, type UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import type { DashboardSession } from "@/components/rfq/dashboard/hooks/useGapDocumentActions";
import type {
  CatalogPayload,
  GapFilterKey,
  WorkspaceMode,
} from "@/components/rfq/dashboard/types";
import {
  DEFAULT_DEMO_UPLOAD,
  getDefaultDemoSession,
  isPreloadedDemoUpload,
} from "@/data/sampleRfqPipeline";
import { fetchJsonNoStore } from "@/lib/http/fetchJson";
import { buildCaseDataFromPersisted } from "@/lib/rfq/caseFromPersisted";
import {
  loadGapSessionCache,
  restoreGapSessionCaseData,
  saveGapSessionCache,
} from "@/lib/rfq/gapSessionCache";
import { loadSidebarListCache, saveSidebarListCache } from "@/lib/rfq/sidebarListCache";
import type { RfqParseSessionFull } from "@/lib/rfq/sqlite/parseSessions";
import { loadWorkspacePrefs, saveWorkspacePrefs } from "@/lib/rfq/workspacePrefsCache";

const WORKBOOK_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** SQLite rows arrive without the upload's original mime/size, so they are reconstructed. */
function uploadedFileFromPersistedRow(row: {
  session_id: string;
  original_filename: string;
}): UploadedPackageFile {
  const isLegacyXls = row.original_filename.toLowerCase().endsWith(".xls");
  return {
    id: row.session_id,
    originalName: row.original_filename,
    size: 0,
    mimeType: isLegacyXls ? "application/vnd.ms-excel" : WORKBOOK_MIME,
    storedName: STORED_NAME_DB_ONLY,
  };
}

/** Union of two lists by id, preserving order and preferring the first occurrence. */
function mergeById(
  primary: UploadedPackageFile[],
  secondary: UploadedPackageFile[],
): UploadedPackageFile[] {
  const seen = new Set<string>();
  const out: UploadedPackageFile[] = [];
  for (const u of [...primary, ...secondary]) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    out.push(u);
  }
  return out;
}

export type RfqWorkspaceOptions = {
  showPortfolio: boolean;
  showQuoteHistory: boolean;
  /**
   * Owned by the shell rather than this hook: `useKbCatalog` also needs them,
   * and threading them down avoids a cycle between the two hooks.
   */
  workspaceMode: WorkspaceMode;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  extractPackages: ExtractPackageSummary[];
  selectedExtractKey: string | null;
  setSelectedExtractKey: (key: string | null) => void;
  /** Called after an analysis completes so the header counts stay current. */
  refreshCatalog: () => Promise<void>;
  /** Seeds the catalog from the single fetch that also builds the sidebar list. */
  setCatalog: (payload: CatalogPayload) => void;
};

/**
 * Owns the dashboard's interdependent workspace state: which RFQ is loaded,
 * which workspace and sub-mode are showing, the sidebar upload list, and the
 * hydration handshake that restores all three after a refresh.
 *
 * These cannot be split further without inventing cross-hook signalling — the
 * "restore prefs, then load the RFQ they point at" sequence is one flow. What
 * is separated is the rendering: this file holds no JSX.
 */
export function useRfqWorkspace(options: RfqWorkspaceOptions) {
  const {
    showPortfolio,
    showQuoteHistory,
    workspaceMode,
    setWorkspaceMode,
    extractPackages,
    selectedExtractKey,
    setSelectedExtractKey,
    refreshCatalog,
    setCatalog,
  } = options;

  const [session, setSession] = useState<DashboardSession>(null);
  /** Every successful upload stays listed here (sidebar) even when the view is reset. */
  const [uploadedRfqs, setUploadedRfqs] = useState<UploadedPackageFile[]>([]);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [analysisSubMode, setAnalysisSubMode] = useState<AnalysisSubMode>("summary");
  const [analysisSelection, setAnalysisSelection] = useState<AnalysisSelection | null>(null);
  const [gapFilter, setGapFilter] = useState<GapFilterKey>("all");
  const [sidebarLoadBusy, setSidebarLoadBusy] = useState(false);
  /** Set after the first catalog/cache merge; gates cache writes so we never persist an empty list. */
  const [hydrated, setHydrated] = useState(false);

  const prefsRestoredRef = useRef(false);
  /** Blocks prefs/cache writes until startup restore finishes. */
  const initialHydrationDoneRef = useRef(false);
  /** Avoids re-fetch loops when a selected upload has no stored analysis. */
  const sessionEnsureKeyRef = useRef<string | null>(null);

  const caseData = session?.caseData ?? null;
  const isAnalysis = workspaceMode === "analysis";

  // Portfolio can be switched off by env; fall back rather than render a dead pane.
  useEffect(() => {
    if (!showPortfolio && workspaceMode === "portfolio") setWorkspaceMode("library");
  }, [showPortfolio, workspaceMode, setWorkspaceMode]);

  useEffect(() => {
    if (showQuoteHistory || analysisSubMode !== "quote") return;
    setAnalysisSubMode("summary");
  }, [showQuoteHistory, analysisSubMode]);

  /**
   * Rehydrate the sidebar after refresh/login: SQLite via the catalog when
   * reachable, else the localStorage backup. Logout only clears auth keys —
   * RFQs stay in `data/rfq.sqlite` and in this cache.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let fromSource: UploadedPackageFile[] = [];
      try {
        const data = await fetchJsonNoStore<CatalogPayload>(
          "/api/rfq/database/catalog",
          "Load failed",
        );
        if (!cancelled) setCatalog(data);
        const fromApi = Array.isArray(data.upload_analyses)
          ? data.upload_analyses.map(uploadedFileFromPersistedRow)
          : [];
        fromSource = mergeById(fromApi, loadSidebarListCache());
      } catch {
        fromSource = loadSidebarListCache();
      }
      if (cancelled) return;
      setUploadedRfqs((prev) => mergeById(fromSource, prev));
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [setCatalog]);

  useEffect(() => {
    if (!hydrated) return;
    saveSidebarListCache(uploadedRfqs);
  }, [uploadedRfqs, hydrated]);

  useEffect(() => {
    if (!hydrated || !session?.caseData) return;
    saveGapSessionCache(session.file.id, session.caseData);
  }, [session, hydrated]);

  /** On refresh, restore workspace prefs before anything is allowed to persist. */
  useEffect(() => {
    if (!hydrated || prefsRestoredRef.current) return;
    prefsRestoredRef.current = true;

    const prefs = loadWorkspacePrefs();
    if (prefs) {
      setWorkspaceMode(prefs.workspaceMode);
      setAnalysisSubMode(
        prefs.analysisSubMode === "quote" && !showQuoteHistory ? "summary" : prefs.analysisSubMode,
      );
      if (prefs.analysisSelection) setAnalysisSelection(prefs.analysisSelection);
    } else if (!uploadedRfqs.some((u) => !isPreloadedDemoUpload(u))) {
      // First run with nothing of the user's own: land on the demo workbook.
      setWorkspaceMode("analysis");
      setAnalysisSubMode("summary");
      setAnalysisSelection({
        kind: "workbook",
        fileId: DEFAULT_DEMO_UPLOAD.id,
        label: DEFAULT_DEMO_UPLOAD.originalName,
      });
    }

    initialHydrationDoneRef.current = true;
  }, [hydrated, uploadedRfqs, showQuoteHistory, setWorkspaceMode]);

  useEffect(() => {
    if (!hydrated || !initialHydrationDoneRef.current) return;
    saveWorkspacePrefs({ workspaceMode, analysisSubMode, analysisSelection });
  }, [workspaceMode, analysisSubMode, analysisSelection, hydrated]);

  const openDemoWorkbookAnalysis = useCallback((subMode: AnalysisSubMode = "summary") => {
    sessionEnsureKeyRef.current = null;
    setWorkspaceMode("analysis");
    setAnalysisSubMode(subMode);
    setAnalysisSelection({
      kind: "workbook",
      fileId: DEFAULT_DEMO_UPLOAD.id,
      label: DEFAULT_DEMO_UPLOAD.originalName,
    });
    setUploadedRfqs((prev) =>
      prev.some((x) => x.id === DEFAULT_DEMO_UPLOAD.id) ? prev : [DEFAULT_DEMO_UPLOAD, ...prev],
    );
    const defaultSession = getDefaultDemoSession();
    setSession({
      file: defaultSession.file,
      caseData: restoreGapSessionCaseData(DEFAULT_DEMO_UPLOAD.id, defaultSession.caseData),
    });
    setSessionNotice(null);
    setSidebarLoadBusy(false);
    setPipelineBusy(false);
    setGapFilter("all");
  }, [setWorkspaceMode]);

  /**
   * Loads a stored analysis into the dashboard, falling back to the local gap
   * cache when the row is missing or the network fails.
   */
  const activateRfq = useCallback(
    async (u: UploadedPackageFile) => {
      if (pipelineBusy || sidebarLoadBusy) return;
      if (isPreloadedDemoUpload(u)) {
        openDemoWorkbookAnalysis(analysisSubMode);
        return;
      }
      setSidebarLoadBusy(true);
      setSessionNotice(null);

      const fallBackToCache = (notice: string) => {
        const cached = loadGapSessionCache(u.id);
        if (cached) {
          setSession({ file: u, caseData: cached });
          setSessionNotice(null);
        } else {
          setSessionNotice(notice);
        }
      };

      try {
        const res = await fetch(`/api/rfq/database/sessions/${encodeURIComponent(u.id)}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const row = (await res.json()) as RfqParseSessionFull;
          const fileDb: UploadedPackageFile = {
            id: u.id,
            originalName: u.originalName,
            size: u.size,
            mimeType: u.mimeType || WORKBOOK_MIME,
            storedName: STORED_NAME_DB_ONLY,
          };
          setSession({
            file: fileDb,
            caseData: restoreGapSessionCaseData(u.id, buildCaseDataFromPersisted(row, fileDb)),
          });
          setPipelineBusy(false);
          setGapFilter("all");
          return;
        }
        fallBackToCache(
          res.status === 404
            ? "No stored analysis for this upload. Run analysis while the workbook file is on the server, or upload the workbook again."
            : `Could not load RFQ (${res.status}).`,
        );
      } catch {
        fallBackToCache("Network error loading stored RFQ.");
      } finally {
        setSidebarLoadBusy(false);
      }
    },
    [pipelineBusy, sidebarLoadBusy, analysisSubMode, openDemoWorkbookAnalysis],
  );

  const selectWorkbook = useCallback(
    (u: UploadedPackageFile) => {
      sessionEnsureKeyRef.current = null;
      if (u.id === DEFAULT_DEMO_UPLOAD.id) {
        openDemoWorkbookAnalysis(analysisSubMode);
        return;
      }
      setWorkspaceMode("analysis");
      setAnalysisSelection({ kind: "workbook", fileId: u.id, label: u.originalName });
      void activateRfq(u);
    },
    [analysisSubMode, openDemoWorkbookAnalysis, activateRfq, setWorkspaceMode],
  );

  const selectWordPackage = useCallback(
    (key: string) => {
      const pkg = extractPackages.find((p) => p.key === key);
      if (!pkg) return;
      setWorkspaceMode("analysis");
      setSelectedExtractKey(key);
      setAnalysisSelection({ kind: "word", packageKey: key, label: pkg.filename });
    },
    [extractPackages, setSelectedExtractKey, setWorkspaceMode],
  );

  /** Load workbook caseData whenever Analysis points at a workbook but no session is loaded. */
  useEffect(() => {
    if (!hydrated || !initialHydrationDoneRef.current) return;
    if (!isAnalysis || sidebarLoadBusy || pipelineBusy) return;

    const sel = analysisSelection;
    if (sel?.kind !== "workbook") return;
    if (session?.file.id === sel.fileId && session.caseData) return;

    // Already attempted this file: fall back to cache instead of re-fetching.
    if (sessionEnsureKeyRef.current === sel.fileId) {
      const cached = loadGapSessionCache(sel.fileId);
      if (!cached) return;
      const file =
        uploadedRfqs.find((u) => u.id === sel.fileId) ??
        (sel.fileId === DEFAULT_DEMO_UPLOAD.id
          ? DEFAULT_DEMO_UPLOAD
          : {
              id: sel.fileId,
              originalName: sel.label,
              size: 0,
              mimeType: WORKBOOK_MIME,
              storedName: STORED_NAME_DB_ONLY,
            });
      setSession({ file, caseData: cached });
      return;
    }
    sessionEnsureKeyRef.current = sel.fileId;

    if (sel.fileId === DEFAULT_DEMO_UPLOAD.id) {
      openDemoWorkbookAnalysis(analysisSubMode);
      return;
    }
    const u = uploadedRfqs.find((x) => x.id === sel.fileId);
    if (u) void activateRfq(u);
  }, [
    hydrated,
    isAnalysis,
    analysisSelection,
    analysisSubMode,
    session?.file.id,
    session?.caseData,
    sidebarLoadBusy,
    pipelineBusy,
    uploadedRfqs,
    openDemoWorkbookAnalysis,
    activateRfq,
  ]);

  const addUpload = useCallback((file: UploadedPackageFile) => {
    setUploadedRfqs((prev) => (prev.some((u) => u.id === file.id) ? prev : [file, ...prev]));
  }, []);

  const handleUploaded = useCallback(
    (file: UploadedPackageFile) => {
      addUpload(file);
      setSessionNotice(
        workspaceMode === "analysis"
          ? null
          : `Stored “${file.originalName}”. Analysis runs only for the 4-sheet workbook format.`,
      );
    },
    [addUpload, workspaceMode],
  );

  const handleAnalyzed = useCallback(
    async (file: UploadedPackageFile) => {
      addUpload(file);
      /**
       * Batch-upload race: when N workbooks are dropped at once every analysis
       * fires this callback. Only auto-activate if nothing else is already
       * driving the dashboard, so the user's open RFQ is not yanked away by a
       * later finisher.
       */
      if (session === null || workspaceMode === "analysis") {
        setSessionNotice(null);
        setWorkspaceMode("analysis");
        setAnalysisSubMode("summary");
        setAnalysisSelection({ kind: "workbook", fileId: file.id, label: file.originalName });
        await activateRfq(file);
      } else if (session.file.id !== file.id) {
        setSessionNotice(`Analyzed “${file.originalName}”. Open it from the sidebar when ready.`);
      }
      void refreshCatalog();
    },
    [addUpload, session, workspaceMode, activateRfq, refreshCatalog, setWorkspaceMode],
  );

  const userWorkbookUploads = useMemo(
    () => uploadedRfqs.filter((u) => !isPreloadedDemoUpload(u)),
    [uploadedRfqs],
  );

  /** Falls back to the selected Word package, then the loaded session. */
  const resolvedSelection = useMemo((): AnalysisSelection | null => {
    if (analysisSelection) return analysisSelection;
    if (!isAnalysis) return null;
    if (selectedExtractKey) {
      const pkg = extractPackages.find((p) => p.key === selectedExtractKey);
      if (pkg) return { kind: "word", packageKey: pkg.key, label: pkg.filename };
    }
    if (session?.file) {
      return { kind: "workbook", fileId: session.file.id, label: session.file.originalName };
    }
    return null;
  }, [analysisSelection, isAnalysis, selectedExtractKey, extractPackages, session?.file]);

  return {
    session,
    setSession,
    caseData,
    uploadedRfqs,
    userWorkbookUploads,
    pipelineBusy,
    sessionNotice,
    analysisSubMode,
    setAnalysisSubMode,
    analysisSelection,
    setAnalysisSelection,
    resolvedSelection,
    gapFilter,
    setGapFilter,
    sidebarLoadBusy,
    openDemoWorkbookAnalysis,
    selectWorkbook,
    selectWordPackage,
    handleUploaded,
    handleAnalyzed,
  };
}
