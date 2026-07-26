import type { ExternalPriceFetchResult } from "@/lib/rfq/costLookupTypes";

/** supplier_parts.supplier_id used for whichever distributor is configured as the external price reference. */
export const EXTERNAL_SUPPLIER_ID = "TRUSTEDPARTS";
export const EXTERNAL_STALE_DAYS = 7;

/**
 * Seam for fetching a live unit-cost reference from an external distributor.
 *
 * trustedparts.com's *consumer search page* sits behind DataDome bot-detection
 * (robots.txt and ToS both return 403 to automated requests) — scraping that
 * page would mean working around active anti-bot countermeasures, so that
 * approach was rejected. But TrustedParts.com separately publishes an official,
 * free Inventory API (https://www.trustedparts.com/en/docs/api) meant for
 * exactly this use case (OEM/quoting-application integration) — that's what
 * trustedPartsApiFetcher.ts uses. Access requires signing up for a free account
 * and requesting API approval (Company ID + API Key, human-reviewed — see
 * TRUSTEDPARTS_COMPANY_ID / TRUSTEDPARTS_API_KEY).
 *
 * Not called from the API request path — costLookupEngine.ts only ever reads
 * whatever supplier_parts row already exists. Refresh a part's cached price via
 * scripts/refresh-trustedparts-price.mjs, run out of band.
 */
export interface ExternalPriceFetcher {
  fetchPricing(partNumber: string): Promise<ExternalPriceFetchResult | null>;
}

export class StubExternalPriceFetcher implements ExternalPriceFetcher {
  async fetchPricing(partNumber: string): Promise<ExternalPriceFetchResult | null> {
    void partNumber;
    return null;
  }
}

export function isSupplierPartStale(
  fetchedAtOrQuoteDate: string | null | undefined,
  maxAgeDays: number = EXTERNAL_STALE_DAYS,
): boolean {
  if (!fetchedAtOrQuoteDate) return true;
  const then = new Date(fetchedAtOrQuoteDate).getTime();
  if (Number.isNaN(then)) return true;
  const ageMs = Date.now() - then;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}
