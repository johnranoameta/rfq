import { NextResponse } from "next/server";

import { badRequest, failureResponse } from "@/lib/http/apiResponse";
import { lookupPartCost } from "@/lib/rfq/costLookupEngine";

export const runtime = "nodejs";

/**
 * Dual-source unit cost lookup for a part at a given quantity: compares the
 * internal Supplier & Part DB against a cached external distributor row (if any)
 * and returns the lower cost with a plain-language explanation. Never fetches
 * live — see src/lib/rfq/externalPriceFetcher.ts and trustedPartsApiFetcher.ts.
 *
 * Query: ?partNumber=<manufacturer part number> (required)
 *        ?quantity=<integer > 0> (required)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partNumber = searchParams.get("partNumber")?.trim();
    const quantityRaw = searchParams.get("quantity");
    const quantity = quantityRaw ? Number(quantityRaw) : NaN;

    if (!partNumber) {
      return badRequest("partNumber is required");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return badRequest("quantity must be a positive number");
    }

    const result = lookupPartCost({ partNumber, quantity });
    return NextResponse.json(result);
  } catch (error) {
    return failureResponse(error, "Failed to look up part cost");
  }
}
