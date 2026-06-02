import fs from "fs";
import path from "path";

const DEFAULT_RFQ_EXTRACTION_ROOT = "D:\\RFQ_EXTRACTION";

/** Python Word-package engine root. Override with RFQ_ENGINE_ROOT when deploying. */
function resolveEngineRoot(): string {
  const fromEnv = process.env.RFQ_ENGINE_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  const candidates = [
    path.join(process.cwd(), ".."),
    DEFAULT_RFQ_EXTRACTION_ROOT,
    path.join(process.cwd(), "..", "word-extract"),
  ];

  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "extract_rfq.py"))) {
      return path.resolve(root);
    }
  }

  return path.resolve(candidates[1] ?? candidates[0]);
}

export const ENGINE_ROOT = resolveEngineRoot();

export const ENGINE_OUTPUT_DIR = path.join(
  process.env.RFQ_OUTPUT_DIR ?? path.join(ENGINE_ROOT, "output"),
);

export const ENGINE_UPLOADS_DIR = path.join(
  process.env.RFQ_UPLOADS_DIR ?? path.join(ENGINE_ROOT, "uploads"),
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
