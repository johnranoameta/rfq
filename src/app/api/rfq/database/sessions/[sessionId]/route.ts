import { NextResponse } from "next/server";

import { badRequest, failureResponse, notFound } from "@/lib/http/apiResponse";
import { deleteRfqParseSession, getRfqParseSession } from "@/lib/rfq/sqlite/parseSessions";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, ctx: RouteParams) {
  const { sessionId } = await ctx.params;
  const id = decodeURIComponent(sessionId || "").trim();
  if (!id) {
    return badRequest("Missing session id");
  }
  try {
    const row = getRfqParseSession(id);
    if (!row) {
      return notFound("Not found");
    }
    return NextResponse.json(row);
  } catch (error) {
    console.error("[database/sessions]", error);
    return failureResponse(error, "Database read failed", 500);
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  const { sessionId } = await ctx.params;
  const id = decodeURIComponent(sessionId || "").trim();
  if (!id) {
    return badRequest("Missing session id");
  }
  try {
    const removed = deleteRfqParseSession(id);
    if (!removed) {
      return notFound("Not found");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[database/sessions DELETE]", error);
    return failureResponse(error, "Database delete failed", 500);
  }
}
