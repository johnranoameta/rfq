import { NextResponse } from "next/server";

import { badRequest, failureResponse } from "@/lib/http/apiResponse";
import { parseSupplierPartsWorkbook } from "@/lib/rfq/parseSupplierPartsWorkbook";
import { upsertSupplierPart } from "@/lib/rfq/sqlite/supplierPartsDb";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Uploads a Supplier & Part DB workbook (.xlsx/.xls) and upserts each row into
 * supplier_parts. See parseSupplierPartsWorkbook.ts for the expected columns.
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("Invalid form data");
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return badRequest("Missing file field");
  }
  if (file.size <= 0) {
    return badRequest("Empty file");
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, skipped } = parseSupplierPartsWorkbook(buffer);
    for (const row of rows) {
      upsertSupplierPart(row);
    }
    return NextResponse.json({ imported: rows.length, skipped });
  } catch (error) {
    return failureResponse(error, "Failed to parse supplier parts workbook", 400);
  }
}
