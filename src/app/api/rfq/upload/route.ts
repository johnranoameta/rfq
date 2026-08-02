import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { badRequest } from "@/lib/http/apiResponse";
import { RFQ_UPLOAD_DIR } from "@/lib/rfq/uploadPaths";

const UPLOAD_DIR = RFQ_UPLOAD_DIR;
const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  ".xlsx",
  ".xls",
]);

const GAP_DOC_EXT = new Set([
  ".pdf",
  ".xlsx",
  ".xls",
  ".doc",
  ".docx",
]);

function extnameSafe(name: string): string {
  const base = path.basename(name).toLowerCase();
  const i = base.lastIndexOf(".");
  if (i <= 0) return "";
  return base.slice(i);
}

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
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  const ext = extnameSafe(file.name);
  const purpose = String(formData.get("purpose") ?? "").trim();
  const allowed = purpose === "gap-doc" ? GAP_DOC_EXT : ALLOWED_EXT;
  if (!ext || !allowed.has(ext)) {
    return NextResponse.json(
      {
        error:
          purpose === "gap-doc"
            ? "Unsupported type. Allowed for gap documents: PDF, Word, or Excel."
            : "Unsupported type. Allowed: Excel workbook (.xlsx/.xls) with 4 RFQ tabs.",
      },
      { status: 415 },
    );
  }

  const id = randomUUID();
  const storedName = `${id}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(UPLOAD_DIR, { recursive: true });
  const diskPath = path.join(UPLOAD_DIR, storedName);
  await writeFile(diskPath, buffer);

  return NextResponse.json({
    id,
    originalName: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    storedName,
  });
}
