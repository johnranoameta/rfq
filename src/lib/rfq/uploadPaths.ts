import path from "path";

export const RFQ_UPLOAD_DIR = path.join(process.cwd(), ".uploads");

/** UUID v4 filename + .pdf only — blocks path traversal. */
const PDF_STORED_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i;

export function isSafePdfStoredName(storedName: string): boolean {
  return PDF_STORED_RE.test(storedName);
}

export function resolveUploadedPdfPath(storedName: string): string | null {
  if (!isSafePdfStoredName(storedName)) return null;
  const root = path.resolve(RFQ_UPLOAD_DIR);
  const full = path.resolve(root, storedName);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!full.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  return full;
}
