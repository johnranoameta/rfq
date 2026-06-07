import { NextResponse } from "next/server";

import { deletePackageByKey } from "@/lib/extraction/packageOutput";
import { packageKey, readExtractionManifest, summarizePackage } from "@/lib/extraction/loadManifest";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("package")?.trim();
  if (!key) {
    return NextResponse.json({ error: "Missing package query parameter" }, { status: 400 });
  }

  try {
    await deletePackageByKey(key);
    const records = await readExtractionManifest();
    return NextResponse.json({
      ok: true,
      packages: records.map((r) => ({ key: packageKey(r), ...summarizePackage(r) })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    const status = message === "Package not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
