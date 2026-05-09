import { NextResponse } from "next/server";

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
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database read failed";
    console.error("[database/portfolio]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
