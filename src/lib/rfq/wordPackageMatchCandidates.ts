import type { NormalizedPackage } from "@/lib/extraction/normalizedTypes";
import type { HistoricalProjectRecord } from "@/lib/rfq/historicalKnowledgeTypes";
import { mapNormalizedToMatchCriteria } from "@/lib/rfq/mapNormalizedToMatch";

const EMPTY_QUOTE = {
  packaging_cost_per_pc: 0,
  quoted_piece_price_usd: 0,
  tooling_cost_usd: 0,
  award_result: "",
};

/** Map a Word-normalized package to a match candidate (peer uploads only — not CSV/seed history). */
export function normalizedPackageToMatchRecord(pkg: NormalizedPackage): HistoricalProjectRecord {
  const criteria = mapNormalizedToMatchCriteria(pkg);
  const displayId = pkg.filename?.trim() || pkg.package_id;

  return {
    project_id: displayId,
    rfq: {
      customer: criteria.customer ?? "",
      program: criteria.program ?? "",
      part_name: criteria.part_name ?? pkg.title ?? pkg.filename ?? "",
      part_number: criteria.part_number ?? "",
      process: criteria.process ?? "",
      material: criteria.material ?? "",
      thickness_mm: criteria.thickness_mm ?? 0,
      annual_volume: criteria.annual_volume ?? 0,
      general_tolerance_mm: 0,
      ppap_level: 0,
      incoterm: "",
      payment_terms: "",
      annual_reduction_pct: 0,
    },
    quote_result: { ...EMPTY_QUOTE },
    notes: `word:${pkg.package_id}`,
  };
}

/** Other Word uploads in normalized.json (excludes the source package). */
export function wordPackageMatchCandidates(
  allPackages: NormalizedPackage[],
  sourcePackageId: string,
): HistoricalProjectRecord[] {
  return allPackages
    .filter((p) => p.package_id !== sourcePackageId)
    .map(normalizedPackageToMatchRecord);
}
