import { spawn } from "child_process";
import { existsSync, readdirSync } from "fs";
import path from "path";

import { ENGINE_ROOT } from "@/lib/extraction/enginePaths";
import { mergeEnvLocal } from "@/lib/extraction/loadEnvLocal";

export type PythonRunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

export function runPythonEngine(
  scriptArgs: string[],
  timeoutMs = 45 * 60 * 1000,
): Promise<PythonRunResult> {
  const python =
    process.env.RFQ_PYTHON?.trim() ||
    (process.platform === "win32" ? "py" : "python3");
  const script = scriptArgs[0];
  const args = scriptArgs.slice(1);

  const appRoot = path.resolve(ENGINE_ROOT, "..");
  const env = mergeEnvLocal(process.env, appRoot);
  if (process.platform !== "win32") {
    const pathParts = [
      "/opt/libreoffice25.2/program",
      "/opt/libreoffice24.8/program",
      "/usr/lib/libreoffice/program",
      "/usr/lib64/libreoffice/program",
      "/usr/bin",
      "/usr/local/bin",
      env.PATH,
    ].filter(Boolean);
    env.PATH = [...new Set(pathParts.join(":").split(":"))].join(":");
    if (!env.RFQ_SOFFICE) {
      const optCandidates: string[] = [];
      try {
        for (const dir of readdirSync("/opt")) {
          if (!dir.startsWith("libreoffice")) continue;
          optCandidates.push(`/opt/${dir}/program/soffice`);
        }
      } catch {
        /* /opt missing */
      }
      const staticCandidates = [
        ...optCandidates,
        "/usr/lib/libreoffice/program/soffice",
        "/usr/lib64/libreoffice/program/soffice",
        "/usr/bin/soffice",
        "/usr/bin/libreoffice",
      ];
      for (const candidate of staticCandidates) {
        if (existsSync(candidate)) {
          env.RFQ_SOFFICE = candidate;
          break;
        }
      }
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(python, [script, ...args], {
      cwd: ENGINE_ROOT,
      env,
      shell: process.platform === "win32",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Extraction timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}
