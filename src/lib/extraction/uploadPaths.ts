import path from "path";

import { ENGINE_UPLOADS_DIR, SUPPORTED_DOC_EXT } from "@/lib/extraction/enginePaths";

export const WORD_UPLOAD_DIR = ENGINE_UPLOADS_DIR;

export function isSafeWordStoredName(storedName: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(doc|docx)$/i.test(
    storedName,
  );
}

export function resolveUploadedWordPath(storedName: string): string | null {
  if (!isSafeWordStoredName(storedName)) return null;
  const root = path.resolve(WORD_UPLOAD_DIR);
  const full = path.resolve(root, storedName);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!full.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const ext = path.extname(full).toLowerCase();
  if (!SUPPORTED_DOC_EXT.has(ext)) return null;
  return full;
}
