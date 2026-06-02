import path from "path";

/**
 * Python Word-package engine root.
 * Set RFQ_ENGINE_ROOT on the server (e.g. path to RFQ_EXTRACTION checkout).
 */
export const ENGINE_ROOT = path.resolve(
  process.env.RFQ_ENGINE_ROOT?.trim() ||
    path.join(process.cwd(), "..", "word-extract"),
);

export const ENGINE_OUTPUT_DIR = path.resolve(
  process.env.RFQ_OUTPUT_DIR?.trim() || path.join(ENGINE_ROOT, "output"),
);

export const ENGINE_UPLOADS_DIR = path.resolve(
  process.env.RFQ_UPLOADS_DIR?.trim() || path.join(ENGINE_ROOT, "uploads"),
);

export const EXTRACTION_MANIFEST = path.join(ENGINE_OUTPUT_DIR, "extraction.json");

export const SUPPORTED_DOC_EXT = new Set([".doc", ".docx"]);

export const DB_FILES = ["rfq.db", "rfq_normalized.db", "rfq_baseline.db"] as const;
export const MANIFEST_FILES = [
  "extraction.json",
  "normalized.json",
  "rfq_objects.json",
] as const;

export const RFQ_OBJECTS_PATH = path.join(ENGINE_OUTPUT_DIR, "rfq_objects.json");
export const RFQ_BASELINE_DB_PATH = path.join(ENGINE_OUTPUT_DIR, "rfq_baseline.db");
