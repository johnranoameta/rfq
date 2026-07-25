import type { TrustedpartsFetchResult } from "@/lib/rfq/costLookupTypes";

export const TRUSTEDPARTS_SUPPLIER_ID = "TRUSTEDPARTS";
export const TRUSTEDPARTS_STALE_DAYS = 7;

/**
 * Seam for the eventual out-of-band Trustedparts.com fetch worker (Playwright,
 * modeled on the child-process shape of runPythonEngine.ts). Deferred until
 * Trustedparts.com's ToS/robots.txt permit automated access is confirmed — see
 * issue #5. Never call this synchronously from an API route; the real
 * implementation runs as its own service and writes results into `supplier_parts`
 * out of band. `lookupPartCost` only ever reads whatever row already exists.
 */
export interface TrustedpartsFetcher {
  fetchPricing(partNumber: string): Promise<TrustedpartsFetchResult | null>;
}

export class StubTrustedpartsFetcher implements TrustedpartsFetcher {
  async fetchPricing(partNumber: string): Promise<TrustedpartsFetchResult | null> {
    void partNumber;
    return null;
  }
}

export function isSupplierPartStale(
  fetchedAtOrQuoteDate: string | null | undefined,
  maxAgeDays: number = TRUSTEDPARTS_STALE_DAYS,
): boolean {
  if (!fetchedAtOrQuoteDate) return true;
  const then = new Date(fetchedAtOrQuoteDate).getTime();
  if (Number.isNaN(then)) return true;
  const ageMs = Date.now() - then;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}
