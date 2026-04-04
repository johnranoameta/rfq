import { NextResponse } from "next/server";

import { listRfqParseSessionSummaries } from "@/lib/rfq/sqlite/parseSessions";
import { listSeedRfqProjects } from "@/lib/rfq/sqlite/seedRfqs";

export const runtime = "nodejs";

/**
 * Full RFQ catalog: persisted PDF analyses + relational seed projects from the pack database.
 */
export async function GET() {
  try {
    const upload_analyses = listRfqParseSessionSummaries();
    const seed_projects = listSeedRfqProjects();
    return NextResponse.json({ upload_analyses, seed_projects });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database read failed";
    console.error("[database/catalog]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
