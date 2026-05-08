import { NextResponse } from "next/server";

import { loadHistoricalKnowledge } from "@/lib/rfq/loadHistoricalKnowledge";

export const runtime = "nodejs";

/**
 * Historical RFQ knowledge base. Primary data: SQLite (`rfq_projects` + `quote_submissions`, `historical_gap_findings`);
 * falls back to JSONL/CSV under `project_files/.../historical_data/`.
 *
 * Query: ?q=substring — filter projects (case-insensitive) over full JSON
 *        ?gaps=0 — omit gap findings (smaller payload)
 */
export async function GET(request: Request) {
  try {
    const bundle = await loadHistoricalKnowledge();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const includeGaps = searchParams.get("gaps") !== "0";

    let projects = bundle.projects;
    if (q) {
      projects = projects.filter((p) => JSON.stringify(p).toLowerCase().includes(q));
    }

    return NextResponse.json({
      meta: {
        projectsSource: bundle.projectsSource,
        gapSource: bundle.gapSource,
        sqlitePathNote:
          "Historical projects load from data/rfq.sqlite (seed tables) when available; gaps table seeded from CSV once.",
        historicalDataDir: bundle.sourceDir,
        totalProjects: bundle.projects.length,
        totalGapFindings: bundle.gapFindings.length,
        returnedProjects: projects.length,
        query: q || null,
      },
      projects,
      gapFindings: includeGaps ? bundle.gapFindings : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load historical knowledge";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
