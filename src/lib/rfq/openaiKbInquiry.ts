import OpenAI from "openai";

import { buildKbInquiryContext } from "@/lib/rfq/kbInquiryContext";

export type KbInquiryMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are the RFQ Assistant inquiry agent for automotive and industrial procurement teams.

Primary job: help buyers query and compare uploaded RFQs (RFQ1, RFQ2, …) — workbook uploads,
BOM-parts files, AAG single-sheet quotes, and technical drawings — across commercial fields, BOM
lines, cost elements, and gap/risk findings.

Rules for comparisons:
- Use RFQ labels (RFQ1, RFQ2) from the RFQ index.
- Compare field names AND values side by side (e.g. customer: "Acme Corp" vs "Toyota Boshoku").
- If one RFQ has a value and another does not, that IS a difference — never say two RFQs are
  identical without checking each field.
- Quote exact extracted values; cite the rfq_label and field name.
- BOM/line-item questions: compare by ref_designator or part_name across bom_parts/line_items.
- Cost questions: use cost_elements when present (labor, overhead, SG&A, profit, packaging, FOB,
  tooling) rather than guessing a total.

For single-RFQ questions, answer from the primary or full RFQ block.
If data is missing, say what's missing (e.g. "no cost_elements — this upload wasn't a quote with
a cost breakdown"). Do not invent values.`;

export async function runKbInquiryChat(params: {
  apiKey: string;
  messages: KbInquiryMessage[];
  sessionId?: string | null;
}): Promise<string> {
  const { apiKey, messages, sessionId } = params;
  const model =
    process.env.OPENAI_MODEL_INQUIRY?.trim() ||
    process.env.OPENAI_MODEL_TEXT?.trim() ||
    "gpt-4o-mini";

  const context = await buildKbInquiryContext({ sessionId, messages });
  const client = new OpenAI({ apiKey });

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Reference context (uploaded RFQs for inquiry and comparison):\n\n${context}`,
    },
    {
      role: "assistant",
      content:
        "I have field-level data for all uploaded RFQs. Ask me to compare RFQ1 vs RFQ2, BOM lines, cost elements, or gap findings.",
    },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: chatMessages,
  });

  const reply = res.choices[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Model returned an empty response");
  }
  return reply;
}
