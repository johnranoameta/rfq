import { NextResponse } from "next/server";

import { badRequest, failureResponse, notFound } from "@/lib/http/apiResponse";
import { deleteHistoricalUploadByProjectId } from "@/lib/rfq/sqlite/historicalUploads";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ projectId: string }> };

export async function DELETE(_request: Request, ctx: RouteParams) {
  const { projectId } = await ctx.params;
  const id = decodeURIComponent(projectId || "").trim();
  if (!id) {
    return badRequest("Missing project id");
  }
  try {
    const removed = deleteHistoricalUploadByProjectId(id);
    if (removed <= 0) {
      return notFound("Not found");
    }
    return NextResponse.json({ ok: true, removed });
  } catch (error) {
    return failureResponse(error, "Delete failed", 500);
  }
}

