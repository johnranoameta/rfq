import { NextResponse } from "next/server";

import {
  loadHistoricalKnowledge,
  rankHistoricalMatches,
  type MatchCriteria,
} from "@/lib/rfq/loadHistoricalKnowledge";

export const runtime = "nodejs";

/**
 * POST body: MatchCriteria + optional limit (default 8)
 * { material?, program?, process?, customer?, part_name?, annual_volume?, limit? }
 */
export async function POST(request: Request) {
  try {
    let body: MatchCriteria & { limit?: number };
    try {
      body = (await request.json()) as MatchCriteria & { limit?: number };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const limit =
      typeof body.limit === "number" && body.limit > 0 && body.limit <= 50 ? body.limit : 8;

    const bundle = await loadHistoricalKnowledge();
    const matches = rankHistoricalMatches(body, bundle.projects, limit);

    return NextResponse.json({
      meta: {
        source: "project_files/RFQ_Agent_Test_Files_Pack/historical_data",
        candidatePool: bundle.projects.length,
        returned: matches.length,
      },
      matches,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Match failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
