"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { ExtractPackageSummary } from "@/components/extraction/RfqWordExtractWorkspace";
import type { AnalysisSelection, AnalysisSubMode } from "@/components/rfq/RfqAnalysisShell";
import type { UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import { useActivateRfq } from "@/components/rfq/dashboard/hooks/useActivateRfq";
import type { DashboardSession } from "@/components/rfq/dashboard/hooks/useGapDocumentActions";
import { useEnsureWorkbookSession } from "@/components/rfq/dashboard/hooks/useEnsureWorkbookSession";
import { useHydrateUploadList } from "@/components/rfq/dashboard/hooks/useHydrateUploadList";
import { useWorkspacePersistence } from "@/components/rfq/dashboard/hooks/useWorkspacePersistence";
import type { CatalogPayload, GapFilterKey, WorkspaceMode } from "@/components/rfq/dashboard/types";
import {
  DEFAULT_DEMO_UPLOAD,
  getDefaultDemoSession,
  isPreloadedDemoUpload,
} from "@/data/sampleRfqPipeline";
import { restoreGapSessionCaseData } from "@/lib/rfq/gapSessionCache";

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
 * Owns which RFQ is loaded, what the Analysis pane points at, and the sidebar
 * upload list.
 *
 * Persistence lives in `useWorkspacePersistence` and the load itself in
 * `useActivateRfq`; what remains here is the state those two operate on plus
 * the selection logic tying them together.
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
  const hydrated = useHydrateUploadList(setUploadedRfqs, setCatalog);

  /** Which fileId the ensure-effect already tried; cleared on an explicit pick. */
  const attemptedFileIdRef = useRef<string | null>(null);

  const caseData = session?.caseData ?? null;
  const isAnalysis = workspaceMode === "analysis";

  const restoreDoneRef = useWorkspacePersistence({
    hydrated,
    uploadedRfqs,
    session,
    workspaceMode,
    analysisSubMode,
    analysisSelection,
    showPortfolio,
    showQuoteHistory,
    setWorkspaceMode,
    setAnalysisSubMode,
    setAnalysisSelection,
  });

  const openDemoWorkbookAnalysis = useCallback(
    (subMode: AnalysisSubMode = "summary") => {
      attemptedFileIdRef.current = null;
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
    },
    [setWorkspaceMode],
  );

  const openDemoAtCurrentSubMode = useCallback(
    () => openDemoWorkbookAnalysis(analysisSubMode),
    [openDemoWorkbookAnalysis, analysisSubMode],
  );

  const activateRfq = useActivateRfq({
    pipelineBusy,
    sidebarLoadBusy,
    setSidebarLoadBusy,
    setSession,
    setSessionNotice,
    setPipelineBusy,
    setGapFilter,
    openDemo: openDemoAtCurrentSubMode,
  });

  const selectWorkbook = useCallback(
    (u: UploadedPackageFile) => {
      attemptedFileIdRef.current = null;
      if (u.id === DEFAULT_DEMO_UPLOAD.id) {
        openDemoAtCurrentSubMode();
        return;
      }
      setWorkspaceMode("analysis");
      setAnalysisSelection({ kind: "workbook", fileId: u.id, label: u.originalName });
      void activateRfq(u);
    },
    [openDemoAtCurrentSubMode, activateRfq, setWorkspaceMode],
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

  useEnsureWorkbookSession({
    hydrated,
    restoreDoneRef,
    isAnalysis,
    sidebarLoadBusy,
    pipelineBusy,
    selection: analysisSelection,
    session,
    uploadedRfqs,
    setSession,
    attemptedFileIdRef,
    openDemo: openDemoAtCurrentSubMode,
    activateRfq,
  });

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

  const sessionFile = session?.file;

  /** Falls back to the selected Word package, then the loaded session. */
  const resolvedSelection = useMemo((): AnalysisSelection | null => {
    if (analysisSelection) return analysisSelection;
    if (!isAnalysis) return null;
    if (selectedExtractKey) {
      const pkg = extractPackages.find((p) => p.key === selectedExtractKey);
      if (pkg) return { kind: "word", packageKey: pkg.key, label: pkg.filename };
    }
    if (sessionFile) {
      return { kind: "workbook", fileId: sessionFile.id, label: sessionFile.originalName };
    }
    return null;
  }, [analysisSelection, isAnalysis, selectedExtractKey, extractPackages, sessionFile]);

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
