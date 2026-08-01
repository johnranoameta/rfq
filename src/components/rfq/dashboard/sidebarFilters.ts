import type { ExtractPackageSummary } from "@/components/extraction/RfqWordExtractWorkspace";
import type { UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import type { KbBucket } from "@/lib/rfq/kbBucketPartition";

/**
 * Sidebar search predicates.
 *
 * The dashboard inlined `sidebarQuery.trim().toLowerCase()` inside six
 * separate `.filter()` callbacks, so the query was re-normalised once per row
 * and each list could drift on which fields it searched.
 */

/** Empty query matches everything, so callers can filter unconditionally. */
function matches(haystack: Array<string | null | undefined>, needle: string): boolean {
  if (!needle) return true;
  return haystack.some((v) => (v ?? "").toLowerCase().includes(needle));
}

export function normalizeSidebarQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Matches on the KB class label, or any contained part/program/part-number. */
export function kbBucketMatchesQuery(bucket: KbBucket, needle: string): boolean {
  if (!needle) return true;
  if (bucket.label.toLowerCase().includes(needle)) return true;
  return bucket.projects.some((p) =>
    matches([p.part_name, p.program_name, p.part_number], needle),
  );
}

export function wordPackageMatchesQuery(pkg: ExtractPackageSummary, needle: string): boolean {
  return matches([pkg.filename, pkg.rfq_number, pkg.title], needle);
}

export function uploadMatchesQuery(upload: UploadedPackageFile, needle: string): boolean {
  return matches([upload.originalName], needle);
}
