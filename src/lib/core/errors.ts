/**
 * Narrowing an `unknown` catch binding to a display string.
 *
 * Replaces the `e instanceof Error ? e.message : "..."` ternary that was
 * repeated ~50 times across routes, panels and lib code.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}
