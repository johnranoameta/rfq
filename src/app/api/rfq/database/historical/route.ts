import { NextResponse } from "next/server";

import { parseHistoricalJsonl } from "@/lib/rfq/historicalKnowledgeParsers";
import type { HistoricalProjectRecord } from "@/lib/rfq/historicalKnowledgeTypes";
import { insertHistoricalUploads, listHistoricalUploadSummaries } from "@/lib/rfq/sqlite/historicalUploads";

export const runtime = "nodejs";

function isHistoricalProjectRecord(v: unknown): v is HistoricalProjectRecord {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.project_id === "string" && o.rfq && o.quote_result;
}

export async function GET() {
  try {
    return NextResponse.json({ historical_uploads: listHistoricalUploadSummaries() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  const ext = file.name.toLowerCase().split(".").pop() || "";
  const text = await file.text();
  let records: HistoricalProjectRecord[] = [];

  if (ext === "jsonl") {
    records = parseHistoricalJsonl(text).filter(isHistoricalProjectRecord);
  } else if (ext === "json") {
    try {
      const arr = JSON.parse(text) as unknown;
      if (!Array.isArray(arr)) {
        return NextResponse.json({ error: "JSON must be an array of historical records" }, { status: 400 });
      }
      records = arr.filter(isHistoricalProjectRecord);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Unsupported type. Use .jsonl or .json" }, { status: 415 });
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid historical records found" }, { status: 400 });
  }

  try {
    const inserted = insertHistoricalUploads({
      records,
      originalFilename: file.name,
      source: "historical_import",
    });
    return NextResponse.json({ ok: true, inserted });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Insert failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

