import { NextResponse } from "next/server";

import { runKbInquiryChat, type KbInquiryMessage } from "@/lib/rfq/openaiKbInquiry";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  messages?: KbInquiryMessage[];
  sessionId?: string | null;
  packageId?: string | null;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "KB inquiry is not configured on this server (missing OPENAI_API_KEY). Add it to .env.local and restart.",
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const messages: KbInquiryMessage[] = [];
  for (const m of raw.slice(-20)) {
    if (!m || typeof m !== "object") continue;
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    const content = typeof m.content === "string" ? m.content.trim() : "";
    if (!role || !content) continue;
    messages.push({ role, content });
  }

  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "Last message must be a non-empty user message" }, { status: 400 });
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : null;
  const packageId =
    typeof body.packageId === "string" && body.packageId.trim() ? body.packageId.trim() : null;

  try {
    const reply = await runKbInquiryChat({ apiKey, messages, sessionId, packageId });
    return NextResponse.json({ reply });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Inquiry failed";
    console.error("[kb-inquiry]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
