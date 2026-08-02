"use client";

import { useEffect, useState } from "react";

import { STORED_NAME_DB_ONLY, type UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import { WORKBOOK_MIME } from "@/components/rfq/dashboard/hooks/useActivateRfq";
import type { CatalogPayload } from "@/components/rfq/dashboard/types";
import { fetchJsonNoStore } from "@/lib/http/fetchJson";
import { loadSidebarListCache } from "@/lib/rfq/sidebarListCache";

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
export function mergeById(
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

/**
 * Rebuilds the sidebar upload list after a refresh or login.
 *
 * SQLite via the catalog is the source of truth when reachable; the
 * localStorage backup fills in anything it does not know about, and stands
 * alone when the request fails. Logout only clears auth keys — RFQs stay in
 * `data/rfq.sqlite` and in that cache.
 *
 * Returns `hydrated`, which gates every cache write: persisting before the
 * merge completes would overwrite the backup with an empty list.
 */
export function useHydrateUploadList(
  setUploadedRfqs: (update: (prev: UploadedPackageFile[]) => UploadedPackageFile[]) => void,
  setCatalog: (payload: CatalogPayload) => void,
): boolean {
  const [hydrated, setHydrated] = useState(false);

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
  }, [setUploadedRfqs, setCatalog]);

  return hydrated;
}
