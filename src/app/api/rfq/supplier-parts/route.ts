import { NextResponse } from "next/server";

import { validateSupplierPartFieldValue } from "@/lib/rfq/supplierPartFieldValidation";
import { createSupplierPart, listSupplierParts } from "@/lib/rfq/sqlite/supplierPartsDb";

export const runtime = "nodejs";

/** Lists all supplier_parts rows (internal quotes + cached external distributor rows). */
export async function GET() {
  try {
    const rows = listSupplierParts();
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load supplier parts";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

/** Creates a single supplier_parts row — backs Supplier & Part DB's "Add part" form. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requiredFields = ["part_number", "supplier_id", "source"] as const;
  const optionalFields = ["currency", "unit_cost", "lead_time", "approval_status"] as const;
  const values: Record<string, string | number | null> = {};

  for (const field of requiredFields) {
    const validation = validateSupplierPartFieldValue(field, body[field]);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    values[field] = validation.value;
  }

  // Only validate/pass optional fields the caller actually supplied — an
  // omitted field should fall through to createSupplierPart's DB defaults,
  // not get coerced to an explicit null that then overrides them.
  for (const field of optionalFields) {
    if (body[field] === undefined) continue;
    const validation = validateSupplierPartFieldValue(field, body[field]);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    values[field] = validation.value;
  }

  const record: Parameters<typeof createSupplierPart>[0] = {
    part_number: values.part_number as string,
    supplier_id: values.supplier_id as string,
    source: values.source as string,
  };
  if ("currency" in values) record.currency = values.currency as string | null;
  if ("unit_cost" in values) record.unit_cost = values.unit_cost as number | null;
  if ("lead_time" in values) record.lead_time = values.lead_time as string | null;
  if ("approval_status" in values) record.approval_status = values.approval_status as string | null;

  try {
    const row = createSupplierPart(record);
    return NextResponse.json({ row }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create supplier part";
    const isDuplicate = message.includes("already exists");
    return NextResponse.json({ error: message }, { status: isDuplicate ? 409 : 503 });
  }
}
