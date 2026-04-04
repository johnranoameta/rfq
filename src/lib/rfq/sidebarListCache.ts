import { STORED_NAME_DB_ONLY, type UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import { isPreloadedDemoUpload } from "@/data/sampleRfqPipeline";

const KEY = "rfq-agent-sidebar-list-v1";

export type SidebarListCacheRow = {
  id: string;
  originalName: string;
  mimeType: string;
  /** Server filename under `.uploads/`; omit when row is DB-only. */
  storedName?: string;
};

/** Backs up sidebar file rows (except demo) across refresh/login (catalog API + SQLite still source of truth when available). */
export function loadSidebarListCache(): UploadedPackageFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SidebarListCacheRow[];
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => ({
      id: x.id,
      originalName: x.originalName,
      size: 0,
      mimeType: x.mimeType || "application/pdf",
      storedName: x.storedName && x.storedName.length > 0 ? x.storedName : STORED_NAME_DB_ONLY,
    }));
  } catch {
    return [];
  }
}

export function saveSidebarListCache(items: UploadedPackageFile[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: SidebarListCacheRow[] = items
      .filter((u) => !isPreloadedDemoUpload(u))
      .map((u) => ({
        id: u.id,
        originalName: u.originalName,
        mimeType: u.mimeType || "application/octet-stream",
        storedName: u.storedName === STORED_NAME_DB_ONLY ? undefined : u.storedName,
      }));
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}
