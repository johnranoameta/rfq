"use client";

import { useCallback, useState } from "react";

import type { UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import type { CaseData } from "@/data/rfqTypes";
import { errorMessage } from "@/lib/core/errors";
import { fetchJson } from "@/lib/http/fetchJson";
import {
  applySuppliedPackageDoc,
  clearSuppliedPackageDoc,
  finalizeGapDocument,
} from "@/lib/rfq/applySuppliedPackageDoc";

export type DashboardSession = { file: UploadedPackageFile; caseData: CaseData } | null;
export type SetDashboardSession = (update: (prev: DashboardSession) => DashboardSession) => void;

export type GapDocumentActions = {
  busySlot: string | null;
  error: string | null;
  /** Uploads (or, for the demo case, simulates) a document for a missing slot. */
  supply: (slotName: string, file: File) => Promise<void>;
  /** Removes a supplied document, reopening the gap. */
  remove: (slotName: string, rule?: string) => void;
  /** Marks a slot's document final; returns the recomputed risk score. */
  finalize: (slotName: string, rule: string) => number | null;
};

/**
 * The three "supply a missing document" mutations against the active case.
 *
 * The demo workbook carries a `gap_catalog`, which is the marker for
 * "apply locally, do not hit the server" — that branch is what lets the demo
 * respond instantly without an upload.
 */
export function useGapDocumentActions(setSession: SetDashboardSession): GapDocumentActions {
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supply = useCallback(
    async (slotName: string, file: File) => {
      setBusySlot(slotName);
      setError(null);
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
          if (nextRisk != null) showRaToast(`Document applied — risk score now ${nextRisk}`);
          return;
        }

        const body = new FormData();
        body.set("file", file);
        body.set("purpose", "gap-doc");
        const data = await fetchJson<{ originalName?: string }>("/api/rfq/upload", "Upload failed", {
          method: "POST",
          body,
        });
        const uploadedLabel = data.originalName || label;
        setSession((prev) =>
          prev?.caseData
            ? { ...prev, caseData: applySuppliedPackageDoc(prev.caseData, slotName, uploadedLabel) }
            : prev,
        );
      } catch (e) {
        setError(errorMessage(e, "Upload failed"));
      } finally {
        setBusySlot(null);
      }
    },
    [setSession],
  );

  const remove = useCallback(
    (slotName: string, rule?: string) => {
      setError(null);
      setSession((prev) =>
        prev?.caseData
          ? { ...prev, caseData: clearSuppliedPackageDoc(prev.caseData, slotName, rule) }
          : prev,
      );
    },
    [setSession],
  );

  const finalize = useCallback(
    (slotName: string, rule: string) => {
      setError(null);
      let nextRisk: number | null = null;
      setSession((prev) => {
        if (!prev?.caseData) return prev;
        const nextCase = finalizeGapDocument(prev.caseData, slotName, rule);
        nextRisk = nextCase.risk_score;
        return { ...prev, caseData: nextCase };
      });
      return nextRisk;
    },
    [setSession],
  );

  return { busySlot, error, supply, remove, finalize };
}

/** Transient bottom-right confirmation toast. */
export function showRaToast(message: string): void {
  const el = document.createElement("div");
  el.className = "fixed bottom-5 right-5 z-[200] rounded-lg px-4 py-2 text-[13px] text-white shadow-lg";
  el.style.background = "#0f2340";
  el.textContent = message;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 2200);
}
