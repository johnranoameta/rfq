import { NextResponse } from "next/server";

import { buildBrowsePayload } from "@/lib/extraction/browsePayload";
import {
  packageKey,
  readExtractionManifest,
  summarizePackage,
} from "@/lib/extraction/loadManifest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("package")?.trim();
  if (!key) {
    return NextResponse.json({ error: "Missing package query parameter" }, { status: 400 });
  }

  const records = await readExtractionManifest();
  const record = records.find((r) => packageKey(r) === key);
  if (!record) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  return NextResponse.json({
    key: packageKey(record),
    summary: summarizePackage(record),
    browse: buildBrowsePayload(record),
  });
}
