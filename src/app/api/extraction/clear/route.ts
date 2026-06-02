import { NextResponse } from "next/server";

import { clearEngineOutput } from "@/lib/extraction/clearOutput";

export const runtime = "nodejs";

export async function POST() {
  try {
    const removed = await clearEngineOutput();
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clear failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
