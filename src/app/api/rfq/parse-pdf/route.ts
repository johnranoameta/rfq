import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    {
      error:
        "PDF parsing is disabled. Use workbook analysis with 4 tabs: Header, Line_Items, Technical_Specs, Supplier_Responses.",
    },
    { status: 410 },
  );
}
