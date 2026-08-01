import { NextResponse } from "next/server";

import { errorMessage } from "@/lib/core/errors";
import { badRequest, errorResponse } from "@/lib/http/apiResponse";
import { deletePackageByKey } from "@/lib/extraction/packageOutput";
import { packageKey, readExtractionManifest, summarizePackage } from "@/lib/extraction/loadManifest";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("package")?.trim();
  if (!key) {
    return badRequest("Missing package query parameter");
  }

  try {
    await deletePackageByKey(key);
    const records = await readExtractionManifest();
    return NextResponse.json({
      ok: true,
      packages: records.map((r) => ({ key: packageKey(r), ...summarizePackage(r) })),
    });
  } catch (error) {
    const message = errorMessage(error, "Delete failed");
    return errorResponse(message, message === "Package not found" ? 404 : 500);
  }
}
