import { NextResponse } from "next/server";

import { listBomParts } from "@/lib/rfq/sqlite/bomPartsDb";

export const runtime = "nodejs";

/** Lists bom_parts rows for one RFQ (?fileId=), uploaded separately from the RFQ package itself. */
export async function GET(request: Request) {
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
  }
  try {
    const rows = listBomParts(fileId);
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load BOM parts";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
