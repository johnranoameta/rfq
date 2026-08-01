import { NextResponse } from "next/server";

import { badRequest, failureResponse } from "@/lib/http/apiResponse";
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
      return badRequest("Invalid JSON body");
    }

    const limit =
      typeof body.limit === "number" && body.limit > 0 && body.limit <= 50 ? body.limit : 8;

    const bundle = await loadHistoricalKnowledge();
    const matches = rankHistoricalMatches(body, bundle.projects, limit);

    return NextResponse.json({
      meta: {
        projectsSource: bundle.projectsSource,
        gapSource: bundle.gapSource,
        candidatePool: bundle.projects.length,
        returned: matches.length,
      },
      matches,
    });
  } catch (error) {
    return failureResponse(error, "Match failed");
  }
}
