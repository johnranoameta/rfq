import OpenAI from "openai";

import { buildKbInquiryContext } from "@/lib/rfq/kbInquiryContext";

export type KbInquiryMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are the RFQ Assistant inquiry agent for automotive and industrial procurement teams.
The primary data source is Word RFQ package extraction: normalized section_slots with field/value tables, attachment text, and section status.
Also answer about knowledge base classes, legacy workbook parses, gaps, and quoting workflows when present in context.

Use only the context provided. If data is missing, say what is unknown and which section or attachment would supply it.
Be concise and practical. Use bullet lists for multi-part answers.
Cite section numbers (e.g. 2.3 Technical Spec) when quoting extracted fields.
Do not invent customer names, prices, or part numbers not present in the context.`;

export async function runKbInquiryChat(params: {
  apiKey: string;
  messages: KbInquiryMessage[];
  sessionId?: string | null;
  packageId?: string | null;
}): Promise<string> {
  const { apiKey, messages, sessionId, packageId } = params;
  const model =
    process.env.OPENAI_MODEL_INQUIRY?.trim() ||
    process.env.OPENAI_MODEL_TEXT?.trim() ||
    "gpt-4o-mini";

  const context = await buildKbInquiryContext({ sessionId, packageId });
  const client = new OpenAI({ apiKey });

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Reference context (RFQ knowledge base and fields):\n\n${context}`,
    },
    {
      role: "assistant",
      content:
        "I have Word extraction data, RFQ field glossary, and knowledge base context. Ask about extracted section fields, attachments, gaps, or procurement classes.",
    },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const res = await client.chat.completions.create({
    model,
    temperature: 0.35,
    messages: chatMessages,
  });

  const reply = res.choices[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Model returned an empty response");
  }
  return reply;
}
