import type { ExtractionRecord } from "@/lib/extraction/loadManifest";

/** Viewer-safe slice of extraction.json (no full paragraph/table blobs). */
export function buildBrowsePayload(record: ExtractionRecord) {
  return {
    sections: record.sections ?? [],
    content_index: record.content_index ?? [],
    section_content: record.section_content ?? [],
    error: record.error ?? null,
    rfq_number: record.rfq_number ?? null,
    source: record.source ?? null,
  };
}
