import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

import { assignKbCategoryForParsed, heuristicKbAssignment, partDisplayNameFromParsed } from "@/lib/rfq/assignKbCategoryForParsed";
import { filterSelfKbProjects } from "@/lib/rfq/buildKbRecordFromParsed";
import { buildGapAnalysisFromWorkbook } from "@/lib/rfq/gapFromWorkbook";
import { loadHistoricalKnowledge, rankHistoricalMatches } from "@/lib/rfq/loadHistoricalKnowledge";
import { mapParsedLineItemsToMatchCriteria, mapParsedToMatchCriteria } from "@/lib/rfq/mapParsedToMatch";
import { runOpenAiGapAnalysis } from "@/lib/rfq/openaiGapAnalysis";
import { parseRfqWorkbook, techSpecForPart } from "@/lib/rfq/parseRfqWorkbook";
import { upsertKnowledgeBaseFromUpload } from "@/lib/rfq/sqlite/kbUploads";
import { upsertRfqParseSession } from "@/lib/rfq/sqlite/parseSessions";
import { resolveUploadedWorkbookPath } from "@/lib/rfq/uploadPaths";
import { workbookToAgentParsed } from "@/lib/rfq/workbookToAgentParsed";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * 4-sheet workbook (Header, Line_Items, Technical_Specs, Supplier_Responses) →
 * historical match → heuristic workbook gaps → optional model-assisted gap pass.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Workbook gap analysis is not configured on this server (missing language-model API key). See the repository README for setup.",
      },
      { status: 503 },
    );
  }

  let body: { storedName?: string; uploadId?: string; originalName?: string };
  try {
    body = (await request.json()) as { storedName?: string; uploadId?: string; originalName?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storedName = typeof body.storedName === "string" ? body.storedName.trim() : "";
  const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : "";
  const originalName = typeof body.originalName === "string" ? body.originalName.trim() : "";
  if (!storedName) {
    return NextResponse.json({ error: "Missing storedName" }, { status: 400 });
  }

  const diskPath = resolveUploadedWorkbookPath(storedName);
  if (!diskPath) {
    return NextResponse.json({ error: "Invalid or unknown .xlsx file" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(diskPath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `Workbook too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  try {
    const workbook = parseRfqWorkbook(buffer);
    const parsed = workbookToAgentParsed(workbook);
    const bundle = await loadHistoricalKnowledge();
    const candidateProjects = filterSelfKbProjects(bundle.projects, uploadId, parsed);
    const criteria = mapParsedToMatchCriteria(parsed);
    const itemCriteria = mapParsedLineItemsToMatchCriteria(parsed);
    const perItemMatches = itemCriteria.map((item, idx) => {
      const li = workbook.line_items[idx];
      const spec = li ? techSpecForPart(li.part_name, workbook.technical_specs) : null;
      const enriched = {
        ...item,
        part_number: li?.item ?? item.part_number ?? null,
        specs_text: spec?.spec_text ?? null,
        feature_text: [li?.system, li?.subsystem, li?.level].filter(Boolean).join(" ") || null,
      };
      return {
        item_index: idx,
        item_label: li?.item || `L${idx + 1}`,
        part_name: li?.part_name || null,
        criteria: enriched,
        matches: rankHistoricalMatches(enriched, candidateProjects, 5),
      };
    });

    // Keep a global/compact list for backward-compatible consumers.
    const dedup = new Map<string, ReturnType<typeof rankHistoricalMatches>[number]>();
    for (const row of perItemMatches) {
      for (const m of row.matches) {
        const prev = dedup.get(m.project_id);
        if (!prev || m.score > prev.score) dedup.set(m.project_id, m);
      }
    }
    const matches = [...dedup.values()]
      .sort((a, b) => b.score - a.score || a.project_id.localeCompare(b.project_id))
      .slice(0, 10);
    const heuristicGap = buildGapAnalysisFromWorkbook(workbook, matches, bundle.gapFindings);
    let gap = heuristicGap;
    try {
      gap = await runOpenAiGapAnalysis({
        apiKey,
        parsed,
        matches,
        heuristicGap,
      });
    } catch (gapErr) {
      console.error("[analyze-uploaded-workbook] model gap analysis failed; using heuristic only", gapErr);
    }

    let kbAssignment = heuristicKbAssignment(parsed as Record<string, unknown>);
    try {
      kbAssignment = await assignKbCategoryForParsed({
        apiKey,
        parsed: parsed as Record<string, unknown>,
      });
    } catch (kbErr) {
      console.error("[analyze-uploaded-workbook] KB category assignment failed; using heuristic", kbErr);
    }

    const parse = {
      mode: "workbook_xlsx" as const,
      model: gap.gap_model ?? "workbook_heuristic",
      extractedTextChars: 0,
      parsed,
      raw: "",
    };

    const historicalPayload = {
      criteria,
      matches,
      per_item_matches: perItemMatches,
      meta: {
        candidatePool: candidateProjects.length,
      },
    };

    if (uploadId && originalName) {
      try {
        upsertRfqParseSession({
          sessionId: uploadId,
          uploadId,
          originalFilename: originalName,
          storedFilename: storedName,
          parse: {
            mode: parse.mode,
            model: parse.model,
            extractedTextChars: parse.extractedTextChars,
            parsed: parse.parsed,
            raw: parse.raw,
          },
          historical: historicalPayload,
          gap,
          kbCategory: { slug: kbAssignment.slug, label: kbAssignment.label },
          partDisplayName: partDisplayNameFromParsed(parsed as Record<string, unknown>),
        });
        try {
          upsertKnowledgeBaseFromUpload({
            sessionId: uploadId,
            parsed: parse.parsed,
            originalFilename: originalName,
            source: "workbook",
          });
        } catch (kbErr) {
          console.error("[analyze-uploaded-workbook] knowledge base append", kbErr);
        }
      } catch (persistErr) {
        console.error("[analyze-uploaded-workbook] persist", persistErr);
      }
    }

    return NextResponse.json({
      parse,
      historical: historicalPayload,
      gap,
      kb_category: {
        slug: kbAssignment.slug,
        label: kbAssignment.label,
        source: kbAssignment.source,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Workbook analysis failed";
    console.error("[analyze-uploaded-workbook]", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
