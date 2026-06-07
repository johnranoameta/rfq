import { randomUUID } from "crypto";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import path from "path";

import {
  ENGINE_OUTPUT_DIR,
  ENGINE_UPLOADS_DIR,
  EXTRACTION_MANIFEST,
} from "@/lib/extraction/enginePaths";
import { packageKey, readExtractionManifest, type ExtractionRecord } from "@/lib/extraction/loadManifest";

const UPLOAD_INDEX_PATH = path.join(ENGINE_UPLOADS_DIR, "index.json");

async function originalNameForPackageId(packageId: string): Promise<string | null> {
  try {
    const raw = await readFile(UPLOAD_INDEX_PATH, "utf-8");
    const index = JSON.parse(raw) as Record<string, { originalName?: string }>;
    const name = index[packageId]?.originalName?.trim();
    return name || null;
  } catch {
    return null;
  }
}
import { runPythonEngine } from "@/lib/extraction/runPythonEngine";

async function writeManifest(records: ExtractionRecord[]): Promise<void> {
  await writeFile(EXTRACTION_MANIFEST, JSON.stringify(records, null, 2), "utf-8");
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(from, to);
    } else if (entry.isFile()) {
      await copyFile(from, to);
    }
  }
}

export function stagingOutputDir(): string {
  return path.join(ENGINE_OUTPUT_DIR, `_staging_${randomUUID()}`);
}

/** Merge a single-file staging run into the shared output folder (append or replace by package id). */
export async function mergeStagingManifest(stagingDir: string): Promise<ExtractionRecord[]> {
  const stagingManifest = path.join(stagingDir, "extraction.json");
  const raw = await readFile(stagingManifest, "utf-8");
  const incoming = JSON.parse(raw) as unknown;
  const newRecords = (Array.isArray(incoming) ? incoming : [incoming]) as ExtractionRecord[];

  const existing = await readExtractionManifest();
  const byKey = new Map<string, ExtractionRecord>();
  for (const rec of existing) {
    if (!rec.error) byKey.set(packageKey(rec), rec);
  }

  for (const rec of newRecords) {
    const key = packageKey(rec);
    const outPkgDir = path.join(ENGINE_OUTPUT_DIR, key);
    try {
      await rm(outPkgDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }

    const stagingPkgDir = path.join(stagingDir, key);
    try {
      await copyDirRecursive(stagingPkgDir, outPkgDir);
    } catch {
      /* package dir may be missing on error rows */
    }

    if (!rec.error) {
      const original = await originalNameForPackageId(key);
      byKey.set(key, original ? { ...rec, original_filename: original } : rec);
    }
  }

  const merged = [...byKey.values()];
  await writeManifest(merged);
  return merged;
}

export async function rebuildDerivedOutputs(opts: { loadDb?: boolean; normalize?: boolean }): Promise<void> {
  const { loadDb = true, normalize = true } = opts;
  const manifestRel = path.join("output", "extraction.json");

  if (loadDb) {
    const db = await runPythonEngine([
      "load_db.py",
      manifestRel,
      "-d",
      path.join("output", "rfq.db"),
      "--reset",
    ]);
    if (db.code !== 0) {
      throw new Error((db.stderr || db.stdout).trim().slice(-1500) || "load_db.py failed");
    }
  }

  if (normalize) {
    const norm = await runPythonEngine([
      "normalize_rfq.py",
      manifestRel,
      "-o",
      path.join("output", "normalized.json"),
      "-d",
      path.join("output", "rfq_normalized.db"),
    ]);
    if (norm.code !== 0) {
      throw new Error((norm.stderr || norm.stdout).trim().slice(-1500) || "normalize_rfq.py failed");
    }
  }
}

/** Remove one extracted package, optional upload file, and rebuild manifests. */
export async function deletePackageByKey(key: string): Promise<void> {
  const id = key.trim();
  if (!id || !/^[a-zA-Z0-9._-]+$/.test(id)) {
    throw new Error("Invalid package id");
  }

  const existing = await readExtractionManifest();
  const next = existing.filter((rec) => packageKey(rec) !== id);
  if (next.length === existing.length) {
    throw new Error("Package not found");
  }

  await writeManifest(next);

  const pkgDir = path.join(ENGINE_OUTPUT_DIR, id);
  try {
    await rm(pkgDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  for (const ext of [".doc", ".docx"]) {
    const uploadPath = path.join(ENGINE_UPLOADS_DIR, `${id}${ext}`);
    try {
      await rm(uploadPath, { force: true });
    } catch {
      /* ignore */
    }
  }

  if (next.length === 0) {
    for (const name of ["normalized.json", "rfq.db", "rfq_normalized.db", "rfq_objects.json"]) {
      try {
        await rm(path.join(ENGINE_OUTPUT_DIR, name), { force: true });
      } catch {
        /* ignore */
      }
    }
    return;
  }

  await rebuildDerivedOutputs({ loadDb: true, normalize: true });
}
