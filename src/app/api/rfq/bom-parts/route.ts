import { NextResponse } from "next/server";

import { badRequest, failureResponse } from "@/lib/http/apiResponse";
import { listBomParts } from "@/lib/rfq/sqlite/bomPartsDb";

export const runtime = "nodejs";

/** Lists bom_parts rows for one RFQ (?fileId=), uploaded separately from the RFQ package itself. */
export async function GET(request: Request) {
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!fileId) {
    return badRequest("Missing fileId");
  }
  try {
    const rows = listBomParts(fileId);
    return NextResponse.json({ rows });
  } catch (error) {
    return failureResponse(error, "Failed to load BOM parts");
  }
}
