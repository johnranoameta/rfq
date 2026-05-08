import path from "path";

export const RFQ_UPLOAD_DIR = path.join(process.cwd(), ".uploads");

export function isSafePdfStoredName(storedName: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i.test(storedName);
}

export function isSafeWorkbookStoredName(storedName: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.xlsx$/i.test(storedName);
}

function resolveStoredFile(storedName: string, ext: "pdf" | "xlsx"): string | null {
  const ok =
    ext === "pdf"
      ? isSafePdfStoredName(storedName)
      : isSafeWorkbookStoredName(storedName);
  if (!ok) return null;
  const root = path.resolve(RFQ_UPLOAD_DIR);
  const full = path.resolve(root, storedName);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!full.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  return full;
}

export function resolveUploadedPdfPath(storedName: string): string | null {
  return resolveStoredFile(storedName, "pdf");
}

export function resolveUploadedWorkbookPath(storedName: string): string | null {
  return resolveStoredFile(storedName, "xlsx");
}
