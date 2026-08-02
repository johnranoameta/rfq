import { NextResponse } from "next/server";

import { failureResponse } from "@/lib/http/apiResponse";
import { clearEngineOutput } from "@/lib/extraction/clearOutput";

export const runtime = "nodejs";

export async function POST() {
  try {
    const removed = await clearEngineOutput();
    return NextResponse.json({ ok: true, removed });
  } catch (error) {
    return failureResponse(error, "Clear failed", 500);
  }
}
