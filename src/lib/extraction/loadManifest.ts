import { readFile } from "fs/promises";

import { EXTRACTION_MANIFEST } from "@/lib/extraction/enginePaths";

export type ExtractionPackageSummary = {
  source: string;
  filename: string;
  rfq_number: string | null;
  title: string | null;
  has_error: boolean;
  error: string | null;
  section_count: number;
  content_count: number;
  attachment_count: number;
};

export type ExtractionRecord = Record<string, unknown>;

export async function readExtractionManifest(): Promise<ExtractionRecord[]> {
  try {
    const raw = await readFile(EXTRACTION_MANIFEST, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) return data as ExtractionRecord[];
    if (data && typeof data === "object") return [data as ExtractionRecord];
    return [];
  } catch {
    return [];
  }
}

export function summarizePackage(record: ExtractionRecord): ExtractionPackageSummary {
  const source = String(record.source ?? "");
  const props = (record.properties as { built_in?: Record<string, unknown> } | undefined)?.built_in;
  return {
    source,
    filename: source ? source.replace(/^.*[\\/]/, "") : "unknown",
    rfq_number: (record.rfq_number as string | undefined) ?? null,
    title: (props?.Title as string | undefined) ?? null,
    has_error: Boolean(record.error),
    error: (record.error as string | undefined) ?? null,
    section_count: Array.isArray(record.sections) ? record.sections.length : 0,
    content_count: Array.isArray(record.content_index) ? record.content_index.length : 0,
    attachment_count: Array.isArray(record.object_pool_files)
      ? record.object_pool_files.length
      : 0,
  };
}

export function packageKey(record: ExtractionRecord): string {
  const source = String(record.source ?? "");
  if (!source) return "unknown";
  const parts = source.split(/[/\\]/);
  const file = parts[parts.length - 1] ?? source;
  const dot = file.lastIndexOf(".");
  return dot > 0 ? file.slice(0, dot) : file;
}
