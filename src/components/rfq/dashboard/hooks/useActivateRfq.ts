"use client";

import { useCallback } from "react";

import { STORED_NAME_DB_ONLY, type UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import type { DashboardSession } from "@/components/rfq/dashboard/hooks/useGapDocumentActions";
import type { GapFilterKey } from "@/components/rfq/dashboard/types";
import { isPreloadedDemoUpload } from "@/data/sampleRfqPipeline";
import { buildCaseDataFromPersisted } from "@/lib/rfq/caseFromPersisted";
import { loadGapSessionCache, restoreGapSessionCaseData } from "@/lib/rfq/gapSessionCache";
import type { RfqParseSessionFull } from "@/lib/rfq/sqlite/parseSessions";

export const WORKBOOK_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type ActivateRfqArgs = {
  pipelineBusy: boolean;
  sidebarLoadBusy: boolean;
  setSidebarLoadBusy: (busy: boolean) => void;
  setSession: (session: DashboardSession) => void;
  setSessionNotice: (notice: string | null) => void;
  setPipelineBusy: (busy: boolean) => void;
  setGapFilter: (filter: GapFilterKey) => void;
  /** The demo workbook is loaded from fixtures, not from SQLite. */
  openDemo: () => void;
};

/**
 * Loads a stored analysis into the dashboard.
 *
 * Three outcomes, all of which must leave the user with something: the row
 * exists and is loaded; the row is missing or the network failed but a local
 * gap cache exists, so that is used silently; or neither, and a notice explains
 * why. The cache fallback is what keeps unsaved gap work alive across a server
 * restart.
 */
export function useActivateRfq(args: ActivateRfqArgs) {
  const {
    pipelineBusy,
    sidebarLoadBusy,
    setSidebarLoadBusy,
    setSession,
    setSessionNotice,
    setPipelineBusy,
    setGapFilter,
    openDemo,
  } = args;

  return useCallback(
    async (u: UploadedPackageFile) => {
      if (pipelineBusy || sidebarLoadBusy) return;
      if (isPreloadedDemoUpload(u)) {
        openDemo();
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
    [
      pipelineBusy,
      sidebarLoadBusy,
      setSidebarLoadBusy,
      setSession,
      setSessionNotice,
      setPipelineBusy,
      setGapFilter,
      openDemo,
    ],
  );
}
