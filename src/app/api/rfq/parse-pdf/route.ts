import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

import { runPdfOpenAiExtraction } from "@/lib/rfq/runPdfOpenAiExtraction";
import { resolveUploadedPdfPath } from "@/lib/rfq/uploadPaths";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PDF_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not set. Add it to .env.local to enable PDF extraction (including scanned PDFs via OpenAI).",
      },
      { status: 503 },
    );
  }

  let body: { storedName?: string };
  try {
    body = (await request.json()) as { storedName?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storedName = typeof body.storedName === "string" ? body.storedName.trim() : "";
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
    const result = await runPdfOpenAiExtraction({ buffer, storedName, apiKey });
    return NextResponse.json({
      mode: result.mode,
      model: result.model,
      extractedTextChars: result.extractedTextChars,
      parsed: result.parsed,
      raw: result.raw,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "OpenAI request failed";
    console.error("[parse-pdf]", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
