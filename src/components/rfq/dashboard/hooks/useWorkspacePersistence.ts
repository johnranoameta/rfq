"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { AnalysisSelection, AnalysisSubMode } from "@/components/rfq/RfqAnalysisShell";
import type { UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import type { DashboardSession } from "@/components/rfq/dashboard/hooks/useGapDocumentActions";
import type { WorkspaceMode } from "@/components/rfq/dashboard/types";
import { DEFAULT_DEMO_UPLOAD, isPreloadedDemoUpload } from "@/data/sampleRfqPipeline";
import { saveGapSessionCache } from "@/lib/rfq/gapSessionCache";
import { saveSidebarListCache } from "@/lib/rfq/sidebarListCache";
import { loadWorkspacePrefs, saveWorkspacePrefs } from "@/lib/rfq/workspacePrefsCache";

export type WorkspacePersistenceArgs = {
  /** True once the sidebar list has been merged from the catalog and cache. */
  hydrated: boolean;
  uploadedRfqs: UploadedPackageFile[];
  session: DashboardSession;
  workspaceMode: WorkspaceMode;
  analysisSubMode: AnalysisSubMode;
  analysisSelection: AnalysisSelection | null;
  showPortfolio: boolean;
  showQuoteHistory: boolean;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  setAnalysisSubMode: (mode: AnalysisSubMode) => void;
  setAnalysisSelection: (selection: AnalysisSelection | null) => void;
};

/**
 * Everything that reads or writes persisted workspace state, plus the two
 * guards that keep the view on an enabled module.
 *
 * Returns a ref that is `true` once the startup restore has finished — nothing
 * may persist before then, or a first render would overwrite the user's saved
 * prefs with defaults.
 */
export function useWorkspacePersistence(args: WorkspacePersistenceArgs): RefObject<boolean> {
  const {
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
  } = args;

  const restoredRef = useRef(false);
  const restoreDoneRef = useRef(false);

  // Portfolio can be switched off by env; fall back rather than render a dead pane.
  useEffect(() => {
    if (!showPortfolio && workspaceMode === "portfolio") setWorkspaceMode("library");
  }, [showPortfolio, workspaceMode, setWorkspaceMode]);

  useEffect(() => {
    if (showQuoteHistory || analysisSubMode !== "quote") return;
    setAnalysisSubMode("summary");
  }, [showQuoteHistory, analysisSubMode, setAnalysisSubMode]);

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
    if (!hydrated || restoredRef.current) return;
    restoredRef.current = true;

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

    restoreDoneRef.current = true;
  }, [
    hydrated,
    uploadedRfqs,
    showQuoteHistory,
    setWorkspaceMode,
    setAnalysisSubMode,
    setAnalysisSelection,
  ]);

  useEffect(() => {
    if (!hydrated || !restoreDoneRef.current) return;
    saveWorkspacePrefs({ workspaceMode, analysisSubMode, analysisSelection });
  }, [workspaceMode, analysisSubMode, analysisSelection, hydrated]);

  return restoreDoneRef;
}
