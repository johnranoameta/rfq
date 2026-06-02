import { NextResponse } from "next/server";

import { getRfqObject, readRfqObjects } from "@/lib/extraction/loadRfqObject";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const packageId = searchParams.get("packageId")?.trim();

  if (packageId) {
    const obj = await getRfqObject(packageId);
    if (!obj) {
      return NextResponse.json({ error: "RFQ object not found" }, { status: 404 });
    }
    return NextResponse.json({ object: obj });
  }

  const objects = await readRfqObjects();
  return NextResponse.json({
    objects: objects.map((o) => ({
      package_id: o.package_id,
      filename: o.filename,
      rfq_number: o.rfq_number,
      title: o.title,
      is_baseline: o.is_baseline,
      built_at: o.built_at,
      field_count: o.field_count,
      filled_field_count: o.filled_field_count,
      catalog_version: o.catalog_version,
    })),
  });
}
