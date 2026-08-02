import { NextResponse } from "next/server";

import { isEditableSupplierPartField, validateSupplierPartFieldValue } from "@/lib/rfq/supplierPartFieldValidation";
import { updateSupplierPartField } from "@/lib/rfq/sqlite/supplierPartsDb";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/** Updates one whitelisted field on a supplier_parts row — backs Supplier & Part DB's inline cell editing. */
export async function PATCH(request: Request, ctx: RouteParams) {
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { field?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const field = body.field;
  if (typeof field !== "string" || !isEditableSupplierPartField(field)) {
    return NextResponse.json({ error: `Field "${String(field)}" is not editable` }, { status: 400 });
  }

  const validation = validateSupplierPartFieldValue(field, body.value);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const row = updateSupplierPartField(id, field, validation.value);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update supplier part";
    const isDuplicate = message.includes("already has this");
    return NextResponse.json({ error: message }, { status: isDuplicate ? 409 : 503 });
  }
}
