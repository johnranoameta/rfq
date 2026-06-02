import { NextResponse } from "next/server";

import {
  packageKey,
  readExtractionManifest,
  summarizePackage,
} from "@/lib/extraction/loadManifest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("package")?.trim();

  const records = await readExtractionManifest();
  if (!key) {
    return NextResponse.json({
      packages: records.map((r) => ({
        key: packageKey(r),
        ...summarizePackage(r),
      })),
    });
  }

  const record = records.find((r) => packageKey(r) === key);
  if (!record) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // Full record only when explicitly requested (large). UI should use /api/extraction/browse.
  const includeRecord = url.searchParams.get("full") === "1";
  return NextResponse.json({
    key: packageKey(record),
    summary: summarizePackage(record),
    ...(includeRecord ? { record } : {}),
  });
}
