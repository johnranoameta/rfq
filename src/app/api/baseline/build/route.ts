import { NextResponse } from "next/server";

import { ENGINE_OUTPUT_DIR } from "@/lib/extraction/enginePaths";
import { readRfqObjects } from "@/lib/extraction/loadRfqObject";
import { runPythonEngine } from "@/lib/extraction/runPythonEngine";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: { baselineId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty body ok */
  }

  const args = [
    "build_rfq_object.py",
    "--extraction",
    `${ENGINE_OUTPUT_DIR}/extraction.json`,
    "--normalized",
    `${ENGINE_OUTPUT_DIR}/normalized.json`,
    "-o",
    `${ENGINE_OUTPUT_DIR}/rfq_objects.json`,
    "-d",
    `${ENGINE_OUTPUT_DIR}/rfq_baseline.db`,
  ];
  if (body.baselineId) {
    args.push("--baseline-id", body.baselineId);
  }

  try {
    const result = await runPythonEngine(args);
    if (result.code !== 0) {
      const detail = (result.stderr || result.stdout).trim().slice(-2000);
      return NextResponse.json(
        { error: "RFQ object build failed", detail: detail || "No output" },
        { status: 500 },
      );
    }

    const objects = await readRfqObjects();
    return NextResponse.json({
      ok: true,
      stdout: result.stdout.slice(-2000),
      objects: objects.map((o) => ({
        package_id: o.package_id,
        filename: o.filename,
        is_baseline: o.is_baseline,
        field_count: o.field_count,
        filled_field_count: o.filled_field_count,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
