import { NextResponse } from "next/server";

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
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  const fileId = formData.get("fileId");
  if (!fileId || typeof fileId !== "string") {
    return NextResponse.json({ error: "Missing fileId field" }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, skipped } = parseBomPartsWorkbook(buffer);
    replaceBomParts(fileId, rows);
    return NextResponse.json({ imported: rows.length, skipped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to parse BOM parts workbook";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
