import { spawn } from "child_process";

import { ENGINE_ROOT } from "@/lib/extraction/enginePaths";

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

  return new Promise((resolve, reject) => {
    const child = spawn(python, [script, ...args], {
      cwd: ENGINE_ROOT,
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
