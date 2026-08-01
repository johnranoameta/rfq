"use client";

import { useCallback, useState } from "react";

import type {
  AnalysisStatusEvent,
  AnalysisStatusKind,
  UploadedPackageFile,
} from "@/components/rfq/RfqPackageUpload";

/** How long a successful "done" pill lingers before the sidebar settles. */
const DONE_PILL_LINGER_MS = 4000;

export type AnalysisStatusEntry = { status: AnalysisStatusKind; message?: string };

export type AnalysisStatusState = {
  byFileId: Record<string, AnalysisStatusEntry>;
  /** Pass to `RfqPackageUpload.onAnalysisStatusChange`. */
  handleEvent: (event: AnalysisStatusEvent) => void;
  /** Status dot class for a sidebar row. */
  dotClassFor: (upload: UploadedPackageFile, activeFileId: string | undefined) => string;
};

/** Per-file pipeline status driving the sidebar progress pills and dots. */
export function useAnalysisStatus(): AnalysisStatusState {
  const [byFileId, setByFileId] = useState<Record<string, AnalysisStatusEntry>>({});

  const handleEvent = useCallback((event: AnalysisStatusEvent) => {
    setByFileId((prev) => ({
      ...prev,
      [event.fileId]: { status: event.status, message: event.message },
    }));
    if (event.status !== "done") return;
    // Self-clear only if it is still "done" — a re-run may have moved it on.
    window.setTimeout(() => {
      setByFileId((prev) => {
        if (prev[event.fileId]?.status !== "done") return prev;
        const next = { ...prev };
        delete next[event.fileId];
        return next;
      });
    }, DONE_PILL_LINGER_MS);
  }, []);

  const dotClassFor = useCallback(
    (upload: UploadedPackageFile, activeFileId: string | undefined) => {
      if (activeFileId === upload.id) return "dot-amber";
      const entry = byFileId[upload.id];
      if (entry?.status === "error") return "dot-red";
      if (entry?.status === "queued" || entry?.status === "analyzing") return "dot-blue";
      if (entry?.status === "done") return "dot-green";
      return "dot-blue opacity-50";
    },
    [byFileId],
  );

  return { byFileId, handleEvent, dotClassFor };
}
