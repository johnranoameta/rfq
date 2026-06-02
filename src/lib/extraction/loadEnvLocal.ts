import { existsSync, readFileSync } from "fs";
import path from "path";

/** Merge rfq-ui/.env.local into env (PM2 often does not load it for child processes). */
export function mergeEnvLocal(
  base: NodeJS.ProcessEnv,
  cwd = process.cwd(),
): NodeJS.ProcessEnv {
  const envFile = path.join(cwd, ".env.local");
  if (!existsSync(envFile)) {
    return { ...base };
  }

  const merged = { ...base };
  const text = readFileSync(envFile, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    merged[key] = value;
  }

  return merged;
}
