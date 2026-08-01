"use client";

import { useCallback, useMemo, useState } from "react";

import type { CatalogPayload } from "@/components/rfq/dashboard/types";
import { fetchJsonNoStore } from "@/lib/http/fetchJson";
import { partitionKbBuckets, type KbBucket } from "@/lib/rfq/kbBucketPartition";
import type { SeedRfqProjectRow } from "@/lib/rfq/sqlite/seedRfqs";

export type KbCatalogState = {
  catalog: CatalogPayload | null;
  setCatalog: (payload: CatalogPayload) => void;
  /** Re-reads the catalog; ignores failures, keeping the last good payload. */
  refresh: () => Promise<void>;
  buckets: KbBucket[];
  selectedSlug: string | null;
  setSelectedSlug: (slug: string | null) => void;
  selectedBucket: KbBucket | null;
};

/** Holds the catalog payload and the KB class buckets derived from it. */
export function useKbCatalog(): KbCatalogState {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCatalog(await fetchJsonNoStore<CatalogPayload>("/api/rfq/database/catalog", "Load failed"));
    } catch {
      /* keep the last good catalog */
    }
  }, []);

  const buckets = useMemo((): KbBucket[] => {
    const cats = catalog?.kb_categories ?? [];
    if (cats.length === 0) return [];
    return partitionKbBuckets(
      cats,
      (catalog?.seed_projects ?? []) as SeedRfqProjectRow[],
      catalog?.upload_analyses ?? [],
    );
  }, [catalog?.kb_categories, catalog?.seed_projects, catalog?.upload_analyses]);

  /**
   * The selection is derived, not stored-and-corrected: an explicit pick wins
   * while it still names a real class, otherwise the first class with data (or
   * simply the first) stands in. Doing this during render rather than in an
   * effect avoids the extra render pass the old auto-select effect caused.
   */
  const effectiveSlug = useMemo(() => {
    if (selectedSlug && buckets.some((b) => b.slug === selectedSlug)) return selectedSlug;
    return buckets.find((b) => b.projects.length > 0)?.slug ?? buckets[0]?.slug ?? null;
  }, [buckets, selectedSlug]);

  const selectedBucket = useMemo(
    () => (effectiveSlug ? (buckets.find((b) => b.slug === effectiveSlug) ?? null) : null),
    [buckets, effectiveSlug],
  );

  return {
    catalog,
    setCatalog,
    refresh,
    buckets,
    selectedSlug: effectiveSlug,
    setSelectedSlug,
    selectedBucket,
  };
}
