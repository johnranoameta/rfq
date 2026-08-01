import { NextResponse } from "next/server";

import { isEditableBomPartField, validateBomPartFieldValue } from "@/lib/rfq/bomPartFieldValidation";
import { updateBomPartField } from "@/lib/rfq/sqlite/bomPartsDb";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/** Updates one whitelisted field on a bom_parts row — backs BOM Intelligence's inline cell editing (issue #17). */
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
  if (typeof field !== "string" || !isEditableBomPartField(field)) {
    return NextResponse.json({ error: `Field "${String(field)}" is not editable` }, { status: 400 });
  }

  const validation = validateBomPartFieldValue(field, body.value);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const row = updateBomPartField(id, field, validation.value);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update BOM part";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
