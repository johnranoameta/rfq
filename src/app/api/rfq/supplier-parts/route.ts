import { NextResponse } from "next/server";

import { failureResponse } from "@/lib/http/apiResponse";
import { listSupplierParts } from "@/lib/rfq/sqlite/supplierPartsDb";

export const runtime = "nodejs";

/** Lists all supplier_parts rows (internal quotes + cached external distributor rows). */
export async function GET() {
  try {
    const rows = listSupplierParts();
    return NextResponse.json({ rows });
  } catch (error) {
    return failureResponse(error, "Failed to load supplier parts");
  }
}
