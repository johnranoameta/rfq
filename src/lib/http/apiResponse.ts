import { NextResponse } from "next/server";

import { errorMessage } from "@/lib/core/errors";

/**
 * The JSON envelope every `/api/*` route replies with.
 *
 * Routes previously hand-rolled `NextResponse.json({ error: ... }, { status })`
 * at ~123 call sites, each re-deriving the message from an `unknown` catch
 * binding. Centralising it keeps the error shape identical across routes, which
 * is what the client-side `fetchJson` relies on.
 */

/** Client sent something invalid. */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Addressed resource does not exist. */
export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Explicit failure with a caller-chosen status. */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Terminal `catch` handler for a route: narrows `error` to a message and
 * replies with it. `status` defaults to 503, matching the existing routes that
 * surface a failed SQLite/engine call as "service unavailable".
 */
export function failureResponse(
  error: unknown,
  fallback: string,
  status = 503,
): NextResponse {
  return NextResponse.json({ error: errorMessage(error, fallback) }, { status });
}
