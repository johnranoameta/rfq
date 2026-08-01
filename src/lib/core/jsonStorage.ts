/**
 * SSR-safe JSON localStorage access.
 *
 * Every browser cache in `src/lib/rfq/*Cache.ts` repeated the same three
 * guards: bail when `window` is undefined, swallow JSON/quota errors, and
 * validate the parsed shape before trusting it. These helpers own that
 * boilerplate so callers are left with just their own mapping logic.
 */

/**
 * Reads and parses `key`, returning `fallback` when unavailable, unparseable,
 * or rejected by `isValid`. Never throws.
 */
export function readJsonStorage<T>(
  key: string,
  fallback: T,
  isValid?: (parsed: unknown) => boolean,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (isValid && !isValid(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Serializes `value` to `key`. Silently no-ops on SSR and on quota errors. */
export function writeJsonStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — the cache is best-effort */
  }
}

/** Deletes `key`. Silently no-ops on SSR and when storage is unavailable. */
export function removeJsonStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage disabled */
  }
}
