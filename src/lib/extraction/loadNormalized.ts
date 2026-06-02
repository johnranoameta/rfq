import { readFile } from "fs/promises";
import path from "path";

import { ENGINE_OUTPUT_DIR } from "@/lib/extraction/enginePaths";

export type ExpectedFileSlot = {
  icon_label: string | null;
  inline_index: number | null;
  expected: boolean;
  present: boolean;
  filename: string | null;
  file_type: string | null;
  document_role: string | null;
  clean_text: string;
  char_count: number;
  error: string | null;
};

export type SectionFieldRow = {
  field: string;
  value: string;
};

export type SectionSlotRow = {
  section_number: string;
  section_title: string | null;
  section_display: string | null;
  section_path: string | null;
  status: string;
  body_text: string;
  body_char_count: number;
  expected_files: ExpectedFileSlot[];
  fields?: SectionFieldRow[];
};

export type NormalizedPackage = {
  package_id: string;
  filename: string;
  rfq_number: string | null;
  title: string | null;
  normalized_at: string | null;
  summary: Record<string, unknown>;
  section_slots: SectionSlotRow[];
};

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
