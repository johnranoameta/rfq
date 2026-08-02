import { NextResponse } from "next/server";

import { looksLikeBomPartsRfqUpload } from "@/lib/rfq/parseBomPartsAsRfqWorkbook";
import { parseBomPartsWorkbookAsSupplierParts } from "@/lib/rfq/parseBomPartsAsSupplierParts";
import { parseSupplierPartsWorkbook } from "@/lib/rfq/parseSupplierPartsWorkbook";
import { upsertSupplierPart } from "@/lib/rfq/sqlite/supplierPartsDb";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Uploads a Supplier & Part DB workbook (.xlsx/.xls) and upserts each row into
 * supplier_parts. Accepts either the flat part_number/supplier_id/unit_cost table
 * described in parseSupplierPartsWorkbook.ts, or a BOM-parts-shaped workbook (a
 * `parts` sheet, e.g. docs/sample_supplier_and_part_data.xlsx) — the same shape
 * BOM Intelligence accepts — mapped via parseBomPartsAsSupplierParts.ts.
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, skipped } = looksLikeBomPartsRfqUpload(buffer)
      ? parseBomPartsWorkbookAsSupplierParts(buffer)
      : parseSupplierPartsWorkbook(buffer);
    for (const row of rows) {
      upsertSupplierPart(row);
    }
    return NextResponse.json({ imported: rows.length, skipped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to parse supplier parts workbook";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
