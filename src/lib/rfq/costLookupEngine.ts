import { getInternalCostRows, getExternalCostRow } from "@/lib/rfq/sqlite/supplierPartsDb";
import { parsePriceBreaksJson, resolveUnitCostAtQuantity } from "@/lib/rfq/costLookupPriceBreaks";
import { compareCostSources } from "@/lib/rfq/costLookupSelection";
import { isSupplierPartStale } from "@/lib/rfq/externalPriceFetcher";
import type { CostSelectionResult, ResolvedUnitCost } from "@/lib/rfq/costLookupTypes";

/**
 * Resolves the best unit cost for a part at a given quantity by comparing the
 * internal Supplier & Part DB against the cached external distributor row (if
 * any — see externalPriceFetcher.ts / trustedPartsApiFetcher.ts). Never fetches
 * live; the external fetch is a separate out-of-band worker
 * (scripts/refresh-trustedparts-price.mjs). This only reads whatever row currently
 * exists and reports its staleness.
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

  const externalRow = getExternalCostRow(partNumber);
  const external = externalRow
    ? resolveUnitCostAtQuantity(
        parsePriceBreaksJson(externalRow.price_breaks_json),
        externalRow.unit_cost,
        externalRow.currency,
        quantity,
      )
    : null;
  const externalStale = externalRow ? isSupplierPartStale(externalRow.fetched_at) : false;

  return compareCostSources({
    quantity,
    internal: bestInternal,
    external,
    externalSourceLabel: externalRow?.source ?? null,
    externalStale,
  });
}
