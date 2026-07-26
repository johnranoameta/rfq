import type { PriceBreakTier, ResolvedUnitCost } from "@/lib/rfq/costLookupTypes";

/**
 * Resolves the applicable unit cost at `quantity`, given a price-break table
 * (exact tier match, or the next tier down). Falls back to `flatUnitCost` as an
 * implicit tier at min_qty = 1 when no price breaks are available. If `quantity`
 * is below the lowest available tier, uses that lowest tier and flags
 * `belowMinTier` rather than failing.
 */
export function resolveUnitCostAtQuantity(
  tiers: PriceBreakTier[] | null | undefined,
  flatUnitCost: number | null | undefined,
  currency: string,
  quantity: number,
): ResolvedUnitCost | null {
  const sortedTiers = (tiers ?? []).slice().sort((a, b) => a.min_qty - b.min_qty);

  if (sortedTiers.length === 0) {
    if (flatUnitCost == null) return null;
    return {
      unitCost: flatUnitCost,
      currency,
      tierMinQty: 1,
      belowMinTier: false,
    };
  }

  const lowestTier = sortedTiers[0];
  if (quantity < lowestTier.min_qty) {
    return {
      unitCost: lowestTier.unit_cost,
      currency,
      tierMinQty: lowestTier.min_qty,
      belowMinTier: true,
    };
  }

  let applicable = lowestTier;
  for (const tier of sortedTiers) {
    if (tier.min_qty <= quantity) {
      applicable = tier;
    } else {
      break;
    }
  }

  return {
    unitCost: applicable.unit_cost,
    currency,
    tierMinQty: applicable.min_qty,
    belowMinTier: false,
  };
}

export function parsePriceBreaksJson(json: string | null | undefined): PriceBreakTier[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(
        (t): t is PriceBreakTier =>
          typeof t === "object" && t !== null && typeof t.min_qty === "number" && typeof t.unit_cost === "number",
      )
      .slice()
      .sort((a, b) => a.min_qty - b.min_qty);
  } catch {
    return null;
  }
}
