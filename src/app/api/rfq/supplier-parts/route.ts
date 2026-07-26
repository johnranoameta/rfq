import { NextResponse } from "next/server";

import { listSupplierParts } from "@/lib/rfq/sqlite/supplierPartsDb";

export const runtime = "nodejs";

/** Lists all supplier_parts rows (internal quotes + cached external distributor rows). */
export async function GET() {
  try {
    const rows = listSupplierParts();
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load supplier parts";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
