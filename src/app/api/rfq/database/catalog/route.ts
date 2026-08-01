import { NextResponse } from "next/server";

import { failureResponse } from "@/lib/http/apiResponse";
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
  } catch (error) {
    console.error("[database/catalog]", error);
    return failureResponse(error, "Database read failed", 500);
  }
}
