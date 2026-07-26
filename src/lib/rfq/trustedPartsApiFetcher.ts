import type { ExternalPriceFetchResult, PriceBreakTier } from "@/lib/rfq/costLookupTypes";
import type { ExternalPriceFetcher } from "@/lib/rfq/externalPriceFetcher";

const TRUSTEDPARTS_SEARCH_URL = "https://api.trustedparts.com/v2/search";
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * NOTE on response shape: TrustedParts.com's full request/response schema lives
 * in their Swagger UI (a JS single-page app at api.trustedparts.com/swagger/),
 * which couldn't be fetched programmatically to pin down exact field names.
 * What's confirmed from their published docs: POST JSON to /v2/search, with
 * CompanyId + ApiKey supplied on every request, and a SearchRequests array
 * (max 50 part numbers per call). The fields below are a best-effort guess at
 * a conventional distributor-search response shape (a results array with an
 * offers/price-breaks sub-array per part) — verify against a real response
 * once TRUSTEDPARTS_API_KEY is approved and adjust parseSearchResponse() below;
 * that's the one function that should need to change.
 */
type TrustedPartsPriceBreak = { Quantity?: number; Price?: number | string; Currency?: string };
type TrustedPartsOffer = { ManufacturerPartNumber?: string; PriceBreaks?: TrustedPartsPriceBreak[] };
type TrustedPartsSearchResult = { PartNumber?: string; Offers?: TrustedPartsOffer[] };
type TrustedPartsSearchResponse = { SearchResults?: TrustedPartsSearchResult[]; Errors?: unknown[] };

function parsePrice(price: number | string | undefined): number | null {
  if (typeof price === "number") return Number.isFinite(price) ? price : null;
  if (typeof price !== "string") return null;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseSearchResponse(json: TrustedPartsSearchResponse, partNumber: string): PriceBreakTier[] {
  const results = json.SearchResults ?? [];
  const match =
    results.find((r) => r.PartNumber?.trim().toUpperCase() === partNumber.trim().toUpperCase()) ?? results[0];
  const offers = match?.Offers ?? [];

  const tiers: PriceBreakTier[] = [];
  for (const offer of offers) {
    for (const b of offer.PriceBreaks ?? []) {
      const unit_cost = parsePrice(b.Price);
      if (unit_cost == null || typeof b.Quantity !== "number") continue;
      tiers.push({ min_qty: b.Quantity, unit_cost });
    }
  }
  // Keep the lowest price offered at each quantity tier across all authorized distributors.
  const byQty = new Map<number, number>();
  for (const t of tiers) {
    const existing = byQty.get(t.min_qty);
    if (existing === undefined || t.unit_cost < existing) byQty.set(t.min_qty, t.unit_cost);
  }
  return [...byQty.entries()].map(([min_qty, unit_cost]) => ({ min_qty, unit_cost })).sort((a, b) => a.min_qty - b.min_qty);
}

/**
 * Real distributor price lookup via TrustedParts.com's official Inventory API
 * (free, but access requires signing up and requesting approval — see
 * https://www.trustedparts.com/en/docs/api). Requires TRUSTEDPARTS_COMPANY_ID
 * and TRUSTEDPARTS_API_KEY. Returns null (graceful fallback to internal-only)
 * when unconfigured, on any request error, or when no matching part/price data
 * is found — never throws for those cases.
 */
export class TrustedPartsApiFetcher implements ExternalPriceFetcher {
  async fetchPricing(partNumber: string): Promise<ExternalPriceFetchResult | null> {
    const companyId = process.env.TRUSTEDPARTS_COMPANY_ID;
    const apiKey = process.env.TRUSTEDPARTS_API_KEY;
    if (!companyId || !apiKey) {
      console.warn("TRUSTEDPARTS_COMPANY_ID/TRUSTEDPARTS_API_KEY not set — skipping external price fetch for", partNumber);
      return null;
    }

    let res: Response;
    try {
      res = await fetch(TRUSTEDPARTS_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          CompanyId: companyId,
          ApiKey: apiKey,
          SearchRequests: [{ PartNumber: partNumber }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      console.warn("TrustedParts API request failed for", partNumber, e instanceof Error ? e.message : e);
      return null;
    }

    if (!res.ok) {
      console.warn("TrustedParts API returned", res.status, "for", partNumber);
      return null;
    }

    let json: TrustedPartsSearchResponse;
    try {
      json = (await res.json()) as TrustedPartsSearchResponse;
    } catch {
      return null;
    }

    if (json.Errors && json.Errors.length > 0) {
      console.warn("TrustedParts API error for", partNumber, JSON.stringify(json.Errors));
      return null;
    }

    const tiers = parseSearchResponse(json, partNumber);
    if (tiers.length === 0) return null;

    return { tiers, fetchedAt: new Date().toISOString() };
  }
}
