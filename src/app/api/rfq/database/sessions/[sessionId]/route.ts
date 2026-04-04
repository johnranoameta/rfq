import { NextResponse } from "next/server";

import { deleteRfqParseSession, getRfqParseSession } from "@/lib/rfq/sqlite/parseSessions";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, ctx: RouteParams) {
  const { sessionId } = await ctx.params;
  const id = decodeURIComponent(sessionId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }
  try {
    const row = getRfqParseSession(id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database read failed";
    console.error("[database/sessions]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: RouteParams) {
  const { sessionId } = await ctx.params;
  const id = decodeURIComponent(sessionId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing session id" }, { status: 400 });
  }
  try {
    const removed = deleteRfqParseSession(id);
    if (!removed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database delete failed";
    console.error("[database/sessions DELETE]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
