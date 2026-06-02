import { readFile } from "fs/promises";

import { RFQ_OBJECTS_PATH } from "@/lib/extraction/enginePaths";
import type { RfqObjectPackage } from "@/lib/extraction/rfqObjectTypes";

export type { RfqObjectField, RfqObjectPackage } from "@/lib/extraction/rfqObjectTypes";
export { FIELD_CATEGORIES, getBaselinePackage } from "@/lib/extraction/rfqObjectTypes";

export async function readRfqObjects(): Promise<RfqObjectPackage[]> {
  try {
    const raw = await readFile(RFQ_OBJECTS_PATH, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data as RfqObjectPackage[];
  } catch {
    return [];
  }
}

export async function getRfqObject(packageId: string): Promise<RfqObjectPackage | null> {
  const all = await readRfqObjects();
  return all.find((p) => p.package_id === packageId) ?? null;
}
