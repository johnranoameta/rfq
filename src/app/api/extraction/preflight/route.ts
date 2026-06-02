import { existsSync, readdirSync } from "fs";
import { NextResponse } from "next/server";
import path from "path";

import { mergeEnvLocal } from "@/lib/extraction/loadEnvLocal";
import { runPythonEngine } from "@/lib/extraction/runPythonEngine";

export const runtime = "nodejs";

function sofficeCandidates(): string[] {
  const list = [
    "/usr/lib/libreoffice/program/soffice",
    "/usr/lib64/libreoffice/program/soffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
  ];
  try {
    for (const dir of readdirSync("/opt")) {
      if (!dir.startsWith("libreoffice")) continue;
      const p = `/opt/${dir}/program/soffice`;
      if (existsSync(p)) list.unshift(p);
    }
  } catch {
    /* ignore */
  }
  return list;
}

export async function GET() {
  const env = mergeEnvLocal(process.env);
  const checks: Record<string, unknown> = {
    platform: process.platform,
    cwd: process.cwd(),
    rfq_python: env.RFQ_PYTHON ?? null,
    rfq_soffice_env: env.RFQ_SOFFICE ?? null,
    soffice_candidates: sofficeCandidates().map((p) => ({
      path: p,
      exists: existsSync(p),
    })),
    env_local: existsSync(path.join(process.cwd(), ".env.local")),
  };

  if (process.platform !== "win32") {
    try {
      const result = await runPythonEngine(
        ["-c", "from extractors.libreoffice_convert import find_soffice; print(find_soffice())"],
        30_000,
      );
      checks.python_find_soffice = {
        code: result.code,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim().slice(-500),
      };
    } catch (err) {
      checks.python_find_soffice = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const ready =
    process.platform === "win32" ||
    Boolean(
      checks.python_find_soffice &&
        typeof checks.python_find_soffice === "object" &&
        (checks.python_find_soffice as { stdout?: string }).stdout,
    );

  return NextResponse.json({
    ready,
    message: ready
      ? "Extraction host looks configured."
      : "Install LibreOffice on this server and set RFQ_SOFFICE in .env.local, then pm2 restart.",
    checks,
  });
}
