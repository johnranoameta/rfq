import { readFile } from "fs/promises";
import path from "path";

import { ENGINE_OUTPUT_DIR } from "@/lib/extraction/enginePaths";
import type { NormalizedPackage } from "@/lib/extraction/normalizedTypes";

export type {
  ExpectedFileSlot,
  NormalizedPackage,
  SectionFieldRow,
  SectionSlotRow,
} from "@/lib/extraction/normalizedTypes";

const NORMALIZED_PATH = path.join(ENGINE_OUTPUT_DIR, "normalized.json");

export async function readNormalizedPackages(): Promise<NormalizedPackage[]> {
  try {
    const raw = await readFile(NORMALIZED_PATH, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data as NormalizedPackage[];
  } catch {
    return [];
  }
}

export async function getNormalizedPackage(packageId: string): Promise<NormalizedPackage | null> {
  const packages = await readNormalizedPackages();
  return packages.find((p) => p.package_id === packageId) ?? null;
}
