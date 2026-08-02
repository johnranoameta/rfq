/**
 * Client-side counterpart to `@/lib/http/apiResponse`.
 *
 * Panels repeated this four-line dance around every call: fetch, parse JSON,
 * check `res.ok`, then throw `json.error || "<verb> failed (<status>)"`. The
 * helpers below keep that contract — including the exact thrown message — so
 * existing `catch` blocks and their user-facing copy behave unchanged.
 */

/** Shape every route error reply shares (see `apiResponse.ts`). */
type ErrorEnvelope = { error?: string };

/**
 * Fetches `url` and returns the parsed body.
 *
 * Throws `Error(json.error)` when the route supplied one, else
 * `Error("<fallback> (<status>)")`. A body that is not valid JSON is treated as
 * an empty object, so a non-OK HTML error page still yields the status message.
 */
export async function fetchJson<T>(
  url: string,
  fallback: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as T & ErrorEnvelope;
  if (!res.ok) throw new Error(json.error || `${fallback} (${res.status})`);
  return json;
}

/** `fetchJson` for reads that must bypass the HTTP cache. */
export function fetchJsonNoStore<T>(url: string, fallback: string): Promise<T> {
  return fetchJson<T>(url, fallback, { cache: "no-store" });
}

/** `fetchJson` for a `multipart/form-data` upload. */
export function postFormJson<T>(
  url: string,
  body: FormData,
  fallback: string,
): Promise<T> {
  return fetchJson<T>(url, fallback, { method: "POST", body });
}
