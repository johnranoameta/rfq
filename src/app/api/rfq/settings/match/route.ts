import { NextResponse } from "next/server";

import { getMatchScoringConfig, type MatchScoringConfig } from "@/lib/rfq/matchScoringConfig";
import { clearStoredMatchScoringConfig, saveStoredMatchScoringConfig } from "@/lib/rfq/sqlite/matchSettings";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ config: getMatchScoringConfig() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let body: { config?: MatchScoringConfig };
  try {
    body = (await request.json()) as { config?: MatchScoringConfig };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.config || typeof body.config !== "object") {
    return NextResponse.json({ error: "Missing config object" }, { status: 400 });
  }
  try {
    saveStoredMatchScoringConfig(body.config as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, config: getMatchScoringConfig() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearStoredMatchScoringConfig();
    return NextResponse.json({ ok: true, config: getMatchScoringConfig() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reset settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

