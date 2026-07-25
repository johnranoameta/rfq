import { NextResponse } from "next/server";

import { lookupPartCost } from "@/lib/rfq/costLookupEngine";

export const runtime = "nodejs";

/**
 * Dual-source unit cost lookup for a part at a given quantity: compares the
 * internal Supplier & Part DB against a cached Trustedparts.com row (if any) and
 * returns the lower cost with a plain-language explanation. Never fetches
 * Trustedparts live — see src/lib/rfq/trustedpartsFetcher.ts.
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
      return NextResponse.json({ error: "partNumber is required" }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
    }

    const result = lookupPartCost({ partNumber, quantity });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to look up part cost";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
