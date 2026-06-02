import { NextResponse } from "next/server";

import { getNormalizedPackage, readNormalizedPackages } from "@/lib/extraction/loadNormalized";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const packageId = url.searchParams.get("package")?.trim();

  if (!packageId) {
    const packages = await readNormalizedPackages();
    return NextResponse.json({
      packages: packages.map((p) => ({
        package_id: p.package_id,
        filename: p.filename,
        rfq_number: p.rfq_number,
        title: p.title,
        normalized_at: p.normalized_at,
        section_slot_count: p.section_slots?.length ?? 0,
        summary: p.summary,
      })),
    });
  }

  const pkg = await getNormalizedPackage(packageId);
  if (!pkg) {
    return NextResponse.json(
      { error: "Normalized package not found. Run extraction with Normalize enabled." },
      { status: 404 },
    );
  }

  return NextResponse.json({ package: pkg });
}
