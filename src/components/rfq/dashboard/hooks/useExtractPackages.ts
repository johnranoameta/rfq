"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ExtractPackageSummary } from "@/components/extraction/RfqWordExtractWorkspace";
import { errorMessage } from "@/lib/core/errors";
import { fetchJson, fetchJsonNoStore } from "@/lib/http/fetchJson";

export type ExtractPackagesState = {
  packages: ExtractPackageSummary[];
  selectedKey: string | null;
  selected: ExtractPackageSummary | null;
  setPackages: (packages: ExtractPackageSummary[]) => void;
  setSelectedKey: (key: string | null) => void;
  reload: () => Promise<void>;
  /** Confirms, deletes server-side, then re-points the selection. */
  remove: (pkg: ExtractPackageSummary) => Promise<void>;
};

/**
 * Owns the extracted Word-package list and which one is selected.
 *
 * `reload` and `remove` share the same rule for keeping the selection valid:
 * hold the current key if it still exists, else fall back to the first row.
 */
export function useExtractPackages(): ExtractPackagesState {
  const [packages, setPackages] = useState<ExtractPackageSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const applyList = useCallback((list: ExtractPackageSummary[]) => {
    setPackages(list);
    setSelectedKey((prev) => (prev && list.some((p) => p.key === prev) ? prev : (list[0]?.key ?? null)));
  }, []);

  const reload = useCallback(async () => {
    try {
      const data = await fetchJsonNoStore<{ packages: ExtractPackageSummary[] }>(
        "/api/extraction/manifest",
        "Load failed",
      );
      applyList(data.packages ?? []);
    } catch {
      /* manifest is optional — the Word engine may not be configured */
    }
  }, [applyList]);

  // Load once on mount. The await is inline so it is clear no state is set
  // synchronously during the effect.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchJsonNoStore<{ packages: ExtractPackageSummary[] }>(
        "/api/extraction/manifest",
        "Load failed",
      ).catch(() => null);
      if (cancelled || !data) return;
      applyList(data.packages ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyList]);

  const remove = useCallback(
    async (pkg: ExtractPackageSummary) => {
      if (!window.confirm(`Remove “${pkg.filename}” and delete its extracted data?`)) return;
      try {
        const data = await fetchJson<{ packages?: ExtractPackageSummary[] }>(
          `/api/extraction/package?package=${encodeURIComponent(pkg.key)}`,
          "Delete failed",
          { method: "DELETE" },
        );
        applyList(data.packages ?? []);
      } catch (e) {
        window.alert(errorMessage(e, "Delete failed"));
      }
    },
    [applyList],
  );

  const selected = useMemo(
    () => packages.find((p) => p.key === selectedKey) ?? null,
    [packages, selectedKey],
  );

  return { packages, selectedKey, selected, setPackages, setSelectedKey, reload, remove };
}
