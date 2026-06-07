import { readFile, writeFile } from "fs/promises";
import path from "path";

import { ENGINE_OUTPUT_DIR, ENGINE_UPLOADS_DIR, EXTRACTION_MANIFEST } from "@/lib/extraction/enginePaths";
import {
  packageKey,
  readExtractionManifest,
  type ExtractionRecord,
} from "@/lib/extraction/loadManifest";
import { readNormalizedPackages } from "@/lib/extraction/loadNormalized";

const NORMALIZED_PATH = path.join(ENGINE_OUTPUT_DIR, "normalized.json");
const UPLOAD_INDEX_PATH = path.join(ENGINE_UPLOADS_DIR, "index.json");

type UploadIndex = Record<string, { originalName: string; storedName: string; uploadedAt: string }>;

async function readUploadIndex(): Promise<UploadIndex> {
  try {
    const raw = await readFile(UPLOAD_INDEX_PATH, "utf-8");
    return JSON.parse(raw) as UploadIndex;
  } catch {
    return {};
  }
}

async function writeUploadIndex(index: UploadIndex): Promise<void> {
  await writeFile(UPLOAD_INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
}

/** Record original filename at upload time (package id = stored file stem). */
export async function recordUploadOriginalName(storedName: string, originalName: string): Promise<void> {
  const id = path.basename(storedName, path.extname(storedName));
  const name = originalName.trim();
  if (!id || !name) return;
  const index = await readUploadIndex();
  index[id] = {
    originalName: name,
    storedName,
    uploadedAt: new Date().toISOString(),
  };
  await writeUploadIndex(index);
}

/** Backfill display names for packages extracted before original_filename was stored. */
export async function hydratePackageDisplayNames(): Promise<void> {
  const index = await readUploadIndex();
  if (Object.keys(index).length === 0) return;

  const records = await readExtractionManifest();
  for (const r of records) {
    const id = packageKey(r);
    if (typeof r.original_filename === "string" && r.original_filename.trim()) continue;
    const hit = index[id];
    if (hit?.originalName) {
      await stampPackageDisplayName(id, hit.originalName);
    }
  }
}

export function displayFilenameFromRecord(record: ExtractionRecord): string {
  const original = record.original_filename;
  if (typeof original === "string" && original.trim()) {
    return original.trim();
  }
  const source = String(record.source ?? "");
  return source ? source.replace(/^.*[\\/]/, "") : "unknown";
}

/** Persist human-readable upload name on extraction + normalized outputs. */
export async function stampPackageDisplayName(
  packageId: string,
  originalName: string,
): Promise<void> {
  const id = packageId.trim();
  const name = originalName.trim();
  if (!id || !name) return;

  const records = await readExtractionManifest();
  let manifestChanged = false;
  const nextRecords = records.map((r) => {
    if (packageKey(r) !== id) return r;
    manifestChanged = true;
    return { ...r, original_filename: name };
  });
  if (manifestChanged) {
    await writeFile(EXTRACTION_MANIFEST, JSON.stringify(nextRecords, null, 2), "utf-8");
  }

  const packages = await readNormalizedPackages();
  let normalizedChanged = false;
  const nextPackages = packages.map((p) => {
    if (p.package_id !== id) return p;
    normalizedChanged = true;
    return { ...p, filename: name };
  });
  if (normalizedChanged) {
    await writeFile(NORMALIZED_PATH, JSON.stringify(nextPackages, null, 2), "utf-8");
  }
}
