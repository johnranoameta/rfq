import { NextResponse } from "next/server";

import { badRequest, notFound } from "@/lib/http/apiResponse";
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
    return badRequest("Missing package query parameter");
  }

  const records = await readExtractionManifest();
  const record = records.find((r) => packageKey(r) === key);
  if (!record) {
    return notFound("Package not found");
  }

  return NextResponse.json({
    key: packageKey(record),
    summary: summarizePackage(record),
    browse: buildBrowsePayload(record),
  });
}
