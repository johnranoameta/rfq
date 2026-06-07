import { NextResponse } from "next/server";

import { getNormalizedPackage, readNormalizedPackages } from "@/lib/extraction/loadNormalized";
import { compactRankedMatches } from "@/lib/rfq/compactHistoricalMatch";
import { rankHistoricalMatches, type RankedHistoricalMatch } from "@/lib/rfq/loadHistoricalKnowledge";
import { mapNormalizedToMatchItems } from "@/lib/rfq/mapNormalizedToMatch";
import { wordPackageMatchCandidates } from "@/lib/rfq/wordPackageMatchCandidates";

export const runtime = "nodejs";

/**
 * GET /api/extraction/historical-match?package=<package_id>
 * Rank one Word package against other Word uploads in normalized.json only (no CSV/seed history).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const packageId = url.searchParams.get("package")?.trim() ?? "";
  if (!packageId) {
    return NextResponse.json({ error: "Missing package query parameter" }, { status: 400 });
  }

  const pkg = await getNormalizedPackage(packageId);
  if (!pkg) {
    return NextResponse.json(
      { error: "Package not found in normalized.json — run extraction with Normalize checked" },
      { status: 404 },
    );
  }

  try {
    const allPackages = await readNormalizedPackages();
    const candidates = wordPackageMatchCandidates(allPackages, packageId);
    const items = mapNormalizedToMatchItems(pkg);

    const perItemMatches = items.map((item) => {
      const matches: RankedHistoricalMatch[] = rankHistoricalMatches(item.criteria, candidates, 8);
      return {
        item_index: item.item_index,
        item_label: item.item_label,
        part_name: item.part_name,
        criteria: item.criteria,
        matches: compactRankedMatches(matches),
      };
    });

    const dedup = new Map<string, RankedHistoricalMatch>();
    for (const row of perItemMatches) {
      for (const m of rankHistoricalMatches(row.criteria, candidates, 8)) {
        const prev = dedup.get(m.project_id);
        if (!prev || m.score > prev.score) dedup.set(m.project_id, m);
      }
    }
    const topMatches = [...dedup.values()]
      .sort((a, b) => b.score - a.score || a.project_id.localeCompare(b.project_id))
      .slice(0, 10);

    return NextResponse.json({
      package_id: pkg.package_id,
      filename: pkg.filename,
      rfq_number: pkg.rfq_number,
      meta: {
        projectsSource: "word_packages",
        candidatePool: candidates.length,
        matchEngine: "rankHistoricalMatches",
        matchScope: "word_uploads_only",
        excludesCsvSeedHistory: true,
      },
      criteria: items[0]?.criteria ?? {},
      matches: compactRankedMatches(topMatches),
      per_item_matches: perItemMatches,
      item_historical_comparison: perItemMatches.map((row) => ({
        item_index: row.item_index,
        item_label: row.item_label,
        part_name: row.part_name,
        matches: row.matches,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Word package match failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
