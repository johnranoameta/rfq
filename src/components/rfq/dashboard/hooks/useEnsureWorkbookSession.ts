"use client";

import { useEffect, type RefObject } from "react";

import type { AnalysisSelection } from "@/components/rfq/RfqAnalysisShell";
import { STORED_NAME_DB_ONLY, type UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import { WORKBOOK_MIME } from "@/components/rfq/dashboard/hooks/useActivateRfq";
import type { DashboardSession } from "@/components/rfq/dashboard/hooks/useGapDocumentActions";
import { DEFAULT_DEMO_UPLOAD } from "@/data/sampleRfqPipeline";
import { loadGapSessionCache } from "@/lib/rfq/gapSessionCache";

export type EnsureWorkbookSessionArgs = {
  hydrated: boolean;
  restoreDoneRef: RefObject<boolean>;
  isAnalysis: boolean;
  sidebarLoadBusy: boolean;
  pipelineBusy: boolean;
  selection: AnalysisSelection | null;
  session: DashboardSession;
  uploadedRfqs: UploadedPackageFile[];
  setSession: (session: DashboardSession) => void;
  /**
   * Records which fileId has already been attempted. Owned by the caller so
   * that selecting an RFQ can clear it and force a fresh fetch.
   */
  attemptedFileIdRef: RefObject<string | null>;
  openDemo: () => void;
  activateRfq: (upload: UploadedPackageFile) => Promise<void>;
};

/**
 * Loads the workbook the Analysis pane points at whenever no session is open.
 *
 * This is what makes a page refresh land back on the same RFQ: prefs restore
 * the selection, and this fills in the case data behind it. A `ref` records
 * which fileId has already been attempted so an upload with no stored analysis
 * is tried once and then served from the local gap cache, instead of
 * re-fetching on every render.
 */
export function useEnsureWorkbookSession(args: EnsureWorkbookSessionArgs): void {
  const {
    hydrated,
    restoreDoneRef,
    isAnalysis,
    sidebarLoadBusy,
    pipelineBusy,
    selection,
    session,
    uploadedRfqs,
    setSession,
    attemptedFileIdRef,
    openDemo,
    activateRfq,
  } = args;

  useEffect(() => {
    if (!hydrated || !restoreDoneRef.current) return;
    if (!isAnalysis || sidebarLoadBusy || pipelineBusy) return;
    if (selection?.kind !== "workbook") return;
    if (session?.file.id === selection.fileId && session.caseData) return;

    if (attemptedFileIdRef.current === selection.fileId) {
      const cached = loadGapSessionCache(selection.fileId);
      if (!cached) return;
      const file =
        uploadedRfqs.find((u) => u.id === selection.fileId) ??
        (selection.fileId === DEFAULT_DEMO_UPLOAD.id
          ? DEFAULT_DEMO_UPLOAD
          : {
              id: selection.fileId,
              originalName: selection.label,
              size: 0,
              mimeType: WORKBOOK_MIME,
              storedName: STORED_NAME_DB_ONLY,
            });
      setSession({ file, caseData: cached });
      return;
    }
    attemptedFileIdRef.current = selection.fileId;

    if (selection.fileId === DEFAULT_DEMO_UPLOAD.id) {
      openDemo();
      return;
    }
    const upload = uploadedRfqs.find((u) => u.id === selection.fileId);
    if (upload) void activateRfq(upload);
  }, [
    hydrated,
    restoreDoneRef,
    isAnalysis,
    sidebarLoadBusy,
    pipelineBusy,
    selection,
    session,
    uploadedRfqs,
    setSession,
    attemptedFileIdRef,
    openDemo,
    activateRfq,
  ]);
}
