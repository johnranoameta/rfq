import { NextResponse } from "next/server";

import { listKbCategories } from "@/lib/rfq/sqlite/kbCategories";
import { listRfqParseSessionSummaries } from "@/lib/rfq/sqlite/parseSessions";
import { listHistoricalUploadSummaries } from "@/lib/rfq/sqlite/historicalUploads";
import { listSeedRfqProjects } from "@/lib/rfq/sqlite/seedRfqs";

export const runtime = "nodejs";

/**
 * Full RFQ catalog: persisted PDF analyses + relational seed projects from the pack database.
 */
export async function GET() {
  try {
    const upload_analyses = listRfqParseSessionSummaries();
    const historical_uploads = listHistoricalUploadSummaries();
    const seed_projects = listSeedRfqProjects();
    const kb_categories = listKbCategories();
    return NextResponse.json({ upload_analyses, historical_uploads, seed_projects, kb_categories });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database read failed";
    console.error("[database/catalog]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
