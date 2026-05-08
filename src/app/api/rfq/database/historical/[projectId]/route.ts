import { NextResponse } from "next/server";

import { deleteHistoricalUploadByProjectId } from "@/lib/rfq/sqlite/historicalUploads";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ projectId: string }> };

export async function DELETE(_request: Request, ctx: RouteParams) {
  const { projectId } = await ctx.params;
  const id = decodeURIComponent(projectId || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }
  try {
    const removed = deleteHistoricalUploadByProjectId(id);
    if (removed <= 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

