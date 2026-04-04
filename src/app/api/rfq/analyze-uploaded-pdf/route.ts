import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

import { buildGapAnalysisFromParsed } from "@/lib/rfq/gapFromParsed";
import { loadHistoricalKnowledge, rankHistoricalMatches } from "@/lib/rfq/loadHistoricalKnowledge";
import { mapParsedToMatchCriteria } from "@/lib/rfq/mapParsedToMatch";
import { upsertRfqParseSession } from "@/lib/rfq/sqlite/parseSessions";
import { runPdfOpenAiExtraction } from "@/lib/rfq/runPdfOpenAiExtraction";
import { resolveUploadedPdfPath } from "@/lib/rfq/uploadPaths";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PDF_BYTES = 12 * 1024 * 1024;

/**
 * One call: OpenAI parse + historical match + rule-based gap analysis (uses historical_data CSV for matched projects).
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not set. Add it to .env.local to enable PDF analysis (parse + matching + gaps).",
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

  const diskPath = resolveUploadedPdfPath(storedName);
  if (!diskPath) {
    return NextResponse.json({ error: "Invalid or unknown PDF file" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(diskPath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (buffer.length > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `PDF too large (max ${MAX_PDF_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  try {
    const parse = await runPdfOpenAiExtraction({ buffer, storedName, apiKey });
    const bundle = await loadHistoricalKnowledge();
    const criteria = mapParsedToMatchCriteria(parse.parsed);
    const matches = rankHistoricalMatches(criteria, bundle.projects, 10);
    const gap = buildGapAnalysisFromParsed(parse.parsed, matches, bundle.gapFindings);

    const historicalPayload = {
      criteria,
      matches,
      meta: {
        candidatePool: bundle.projects.length,
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
        });
      } catch (persistErr) {
        console.error("[analyze-uploaded-pdf] persist", persistErr);
      }
    }

    return NextResponse.json({
      parse,
      historical: historicalPayload,
      gap,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    console.error("[analyze-uploaded-pdf]", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
