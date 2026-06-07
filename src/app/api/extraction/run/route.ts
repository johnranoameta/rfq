import { NextResponse } from "next/server";

import { clearEngineOutput } from "@/lib/extraction/clearOutput";
import { ENGINE_OUTPUT_DIR } from "@/lib/extraction/enginePaths";
import { packageKey, readExtractionManifest, summarizePackage } from "@/lib/extraction/loadManifest";
import {
  mergeStagingManifest,
  rebuildDerivedOutputs,
  stagingOutputDir,
} from "@/lib/extraction/packageOutput";
import { mkdir, readFile, rm } from "fs/promises";
import path from "path";
import { isWindowsExtractionHost, windowsExtractionErrorResponse } from "@/lib/extraction/requireWindowsHost";
import { runPythonEngine } from "@/lib/extraction/runPythonEngine";
import { stampPackageDisplayName } from "@/lib/extraction/packageDisplayNames";
import { resolveUploadedWordPath } from "@/lib/extraction/uploadPaths";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: Request) {
  if (!isWindowsExtractionHost()) {
    return NextResponse.json(windowsExtractionErrorResponse(), { status: 503 });
  }
  let body: {
    storedName?: string;
    originalName?: string;
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

  const clearFirst = body.clearFirst === true;
  const loadDb = body.loadDb !== false;
  const normalize = body.normalize !== false;
  const maxDepth = typeof body.maxDepth === "number" ? body.maxDepth : 3;

  const stagingDir = clearFirst ? ENGINE_OUTPUT_DIR : stagingOutputDir();

  try {
    if (clearFirst) {
      await clearEngineOutput();
    } else {
      await mkdir(stagingDir, { recursive: true });
    }

    const args = [
      "extract_rfq.py",
      diskPath,
      "-o",
      stagingDir,
      "--max-depth",
      String(maxDepth),
    ];
    if (clearFirst) {
      if (loadDb) args.push("--load-db");
      if (normalize) args.push("--normalize");
    }

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

    if (!clearFirst) {
      const stagingManifest = path.join(stagingDir, "extraction.json");
      const stagingRaw = await readFile(stagingManifest, "utf-8");
      const stagingParsed = JSON.parse(stagingRaw) as unknown;
      const stagingRecords = (
        Array.isArray(stagingParsed) ? stagingParsed : [stagingParsed]
      ) as Array<Record<string, unknown>>;
      const stagingError = stagingRecords.find((r) => r.error);
      if (stagingError) {
        try {
          await rm(stagingDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
        return NextResponse.json(
          { error: String(stagingError.error) },
          { status: 422 },
        );
      }

      try {
        await mergeStagingManifest(stagingDir);
        if (loadDb || normalize) {
          await rebuildDerivedOutputs({ loadDb, normalize });
        }
      } finally {
        try {
          await rm(stagingDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }

    const records = await readExtractionManifest();
    if (records.length === 0) {
      return NextResponse.json({ error: "extraction.json was not created" }, { status: 500 });
    }

    const lastKey = packageKey(records[records.length - 1]!);
    const last =
      records.find((r) => packageKey(r) === lastKey && !r.error) ?? records[records.length - 1]!;
    if (last.error) {
      return NextResponse.json(
        { error: String(last.error), packages: records.map(summarizePackage) },
        { status: 422 },
      );
    }

    const packageId = path.basename(storedName, path.extname(storedName));
    const originalName =
      typeof body.originalName === "string" && body.originalName.trim()
        ? body.originalName.trim()
        : storedName;
    await stampPackageDisplayName(packageId, originalName);

    const recordsAfterLabel = await readExtractionManifest();

    return NextResponse.json({
      ok: true,
      stdout: result.stdout.slice(-4000),
      packages: recordsAfterLabel.map((r) => ({ key: packageKey(r), ...summarizePackage(r) })),
      summary: {
        key: packageKey(last),
        ...summarizePackage(
          recordsAfterLabel.find((r) => packageKey(r) === packageId) ?? last,
        ),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
