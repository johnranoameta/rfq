"use client";

import { useCallback, useEffect, useState } from "react";
import type { BomPartRow } from "@/lib/rfq/costLookupTypes";
import { errorMessage } from "@/lib/core/errors";

/**
 * Loads (and can upload) the bom_parts rows for one RFQ. Shared between the BOM
 * Intelligence panel (which owns the upload) and the Costing agent panel (which
 * only reads) so both stay in sync off one fetch/upload implementation.
 */
export function useBomParts(fileId: string) {
  const [rows, setRows] = useState<BomPartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rfq/bom-parts?fileId=${encodeURIComponent(fileId)}`, { cache: "no-store" });
      const json = (await res.json()) as { rows?: BomPartRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setRows(json.rows ?? []);
    } catch (e) {
      setError(errorMessage(e, "Failed to load BOM parts"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upload = useCallback(
    async (file: File) => {
      setUploadBusy(true);
      setUploadMessage(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileId", fileId);
        const res = await fetch("/api/rfq/bom-parts/upload", { method: "POST", body: formData });
        const json = (await res.json()) as { imported?: number; skipped?: number; error?: string };
        if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
        setUploadMessage(
          `Imported ${json.imported ?? 0} row(s)${json.skipped ? `, skipped ${json.skipped} malformed row(s)` : ""}.`,
        );
        await reload();
      } catch (e) {
        setUploadMessage(errorMessage(e, "Upload failed"));
      } finally {
        setUploadBusy(false);
      }
    },
    [fileId, reload],
  );

  return { rows, loading, error, uploadBusy, uploadMessage, upload, reload };
}
