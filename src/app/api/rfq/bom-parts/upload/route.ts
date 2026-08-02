import { NextResponse } from "next/server";

import { badRequest, errorResponse, failureResponse } from "@/lib/http/apiResponse";
import { parseBomPartsWorkbook } from "@/lib/rfq/parseBomPartsWorkbook";
import { replaceBomParts } from "@/lib/rfq/sqlite/bomPartsDb";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Uploads a BOM/parts workbook (.xlsx — see docs/sample_supplier_and_part_data.xlsx)
 * for one RFQ (fileId form field) and replaces that RFQ's bom_parts rows. A distinct
 * upload from the RFQ package itself; the Costing agent reads these rows to know
 * which BOM lines exist and their manufacturer part numbers.
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
  const fileId = formData.get("fileId");
  if (!fileId || typeof fileId !== "string") {
    return badRequest("Missing fileId field");
  }
  if (file.size <= 0) {
    return badRequest("Empty file");
  }
  if (file.size > MAX_BYTES) {
    return errorResponse(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`, 413);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, skipped } = parseBomPartsWorkbook(buffer);
    replaceBomParts(fileId, rows);
    return NextResponse.json({ imported: rows.length, skipped });
  } catch (error) {
    return failureResponse(error, "Failed to parse BOM parts workbook", 400);
  }
}
