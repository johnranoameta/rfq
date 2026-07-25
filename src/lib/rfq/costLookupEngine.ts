import { getInternalCostRows, getTrustedpartsRow } from "@/lib/rfq/sqlite/supplierPartsDb";
import { parsePriceBreaksJson, resolveUnitCostAtQuantity } from "@/lib/rfq/costLookupPriceBreaks";
import { compareCostSources } from "@/lib/rfq/costLookupSelection";
import { isSupplierPartStale } from "@/lib/rfq/trustedpartsFetcher";
import type { CostSelectionResult, ResolvedUnitCost } from "@/lib/rfq/costLookupTypes";

/**
 * Resolves the best unit cost for a part at a given quantity by comparing the
 * internal Supplier & Part DB against the cached Trustedparts.com row (if any).
 * Never fetches live — the Trustedparts fetch is a separate out-of-band worker
 * (see trustedpartsFetcher.ts); this only reads whatever row currently exists and
 * reports its staleness.
 */
export function lookupPartCost(params: { partNumber: string; quantity: number }): CostSelectionResult {
  const { partNumber, quantity } = params;

  const internalRows = getInternalCostRows(partNumber);
  let bestInternal: ResolvedUnitCost | null = null;
  for (const row of internalRows) {
    const resolved = resolveUnitCostAtQuantity(
      parsePriceBreaksJson(row.price_breaks_json),
      row.unit_cost,
      row.currency,
      quantity,
    );
    if (resolved && (bestInternal === null || resolved.unitCost < bestInternal.unitCost)) {
      bestInternal = resolved;
    }
  }

  const trustedpartsRow = getTrustedpartsRow(partNumber);
  const trustedparts = trustedpartsRow
    ? resolveUnitCostAtQuantity(
        parsePriceBreaksJson(trustedpartsRow.price_breaks_json),
        trustedpartsRow.unit_cost,
        trustedpartsRow.currency,
        quantity,
      )
    : null;
  const trustedpartsStale = trustedpartsRow ? isSupplierPartStale(trustedpartsRow.fetched_at) : false;

  return compareCostSources({
    quantity,
    internal: bestInternal,
    trustedparts,
    trustedpartsStale,
  });
}
