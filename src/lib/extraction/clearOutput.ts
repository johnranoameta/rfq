import { rm, unlink } from "fs/promises";
import path from "path";
import { readdir } from "fs/promises";

import {
  DB_FILES,
  ENGINE_OUTPUT_DIR,
  MANIFEST_FILES,
} from "@/lib/extraction/enginePaths";

export async function clearEngineOutput(): Promise<string[]> {
  const outputDir = path.resolve(ENGINE_OUTPUT_DIR);
  const removed: string[] = [];

  for (const name of [...DB_FILES, ...MANIFEST_FILES]) {
    const filePath = path.join(outputDir, name);
    try {
      await unlink(filePath);
      removed.push(name);
    } catch {
      /* missing */
    }
  }

  let entries: string[] = [];
  try {
    entries = await readdir(outputDir);
  } catch {
    return removed;
  }

  for (const entry of entries) {
    const child = path.join(outputDir, entry);
    try {
      await rm(child, { recursive: true, force: true });
      removed.push(`${entry}/`);
    } catch {
      /* skip */
    }
  }

  return removed;
}
