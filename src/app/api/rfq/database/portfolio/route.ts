import { NextResponse } from "next/server";

import { failureResponse } from "@/lib/http/apiResponse";
import { loadPortfolioStats } from "@/lib/rfq/sqlite/portfolioStats";

export const runtime = "nodejs";

/**
 * Aggregated cross-RFQ Reference-Score statistics: total band counts plus per-session rows
 * with each RFQ's top historical match. Used by the Portfolio dashboard tab so the client
 * doesn't have to fan out one request per session.
 */
export async function GET() {
  try {
    const stats = loadPortfolioStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[database/portfolio]", error);
    return failureResponse(error, "Database read failed", 500);
  }
}
