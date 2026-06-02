import { NextResponse } from "next/server";

import { clearEngineOutput } from "@/lib/extraction/clearOutput";
import { ENGINE_OUTPUT_DIR } from "@/lib/extraction/enginePaths";
import { readExtractionManifest, summarizePackage } from "@/lib/extraction/loadManifest";
import { isWindowsExtractionHost, windowsExtractionErrorResponse } from "@/lib/extraction/requireWindowsHost";
import { runPythonEngine } from "@/lib/extraction/runPythonEngine";
import { resolveUploadedWordPath } from "@/lib/extraction/uploadPaths";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: Request) {
  if (!isWindowsExtractionHost()) {
    return NextResponse.json(windowsExtractionErrorResponse(), { status: 503 });
  }
  let body: {
    storedName?: string;
    clearFirst?: boolean;
    loadDb?: boolean;
    normalize?: boolean;
    maxDepth?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storedName = typeof body.storedName === "string" ? body.storedName.trim() : "";
  if (!storedName) {
    return NextResponse.json({ error: "Missing storedName" }, { status: 400 });
  }

  const diskPath = resolveUploadedWordPath(storedName);
  if (!diskPath) {
    return NextResponse.json({ error: "Invalid or unknown Word file" }, { status: 400 });
  }

  const clearFirst = body.clearFirst !== false;
  const loadDb = body.loadDb !== false;
  const normalize = body.normalize !== false;
  const maxDepth = typeof body.maxDepth === "number" ? body.maxDepth : 3;

  try {
    if (clearFirst) {
      await clearEngineOutput();
    }

    const args = [
      "extract_rfq.py",
      diskPath,
      "-o",
      ENGINE_OUTPUT_DIR,
      "--max-depth",
      String(maxDepth),
    ];
    if (loadDb) args.push("--load-db");
    if (normalize) args.push("--normalize");

    const result = await runPythonEngine(args);
    if (result.code !== 0) {
      const detail = (result.stderr || result.stdout).trim().slice(-2000);
      return NextResponse.json(
        {
          error: "Python extraction failed",
          code: result.code,
          detail: detail || "No output from extractor",
        },
        { status: 500 },
      );
    }

    const records = await readExtractionManifest();
    if (records.length === 0) {
      return NextResponse.json({ error: "extraction.json was not created" }, { status: 500 });
    }

    const last = records[records.length - 1];
    if (last.error) {
      return NextResponse.json(
        { error: String(last.error), packages: records.map(summarizePackage) },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      stdout: result.stdout.slice(-4000),
      packages: records.map(summarizePackage),
      summary: summarizePackage(last),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
