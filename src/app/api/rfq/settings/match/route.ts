import { NextResponse } from "next/server";

import { badRequest, failureResponse } from "@/lib/http/apiResponse";
import { getMatchScoringConfig, type MatchScoringConfig } from "@/lib/rfq/matchScoringConfig";
import { clearStoredMatchScoringConfig, saveStoredMatchScoringConfig } from "@/lib/rfq/sqlite/matchSettings";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ config: getMatchScoringConfig() });
  } catch (error) {
    return failureResponse(error, "Failed to load settings", 500);
  }
}

export async function PUT(request: Request) {
  let body: { config?: MatchScoringConfig };
  try {
    body = (await request.json()) as { config?: MatchScoringConfig };
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!body.config || typeof body.config !== "object") {
    return badRequest("Missing config object");
  }
  try {
    saveStoredMatchScoringConfig(body.config as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, config: getMatchScoringConfig() });
  } catch (error) {
    return failureResponse(error, "Failed to save settings", 500);
  }
}

export async function DELETE() {
  try {
    clearStoredMatchScoringConfig();
    return NextResponse.json({ ok: true, config: getMatchScoringConfig() });
  } catch (error) {
    return failureResponse(error, "Failed to reset settings", 500);
  }
}

