import OpenAI from "openai";

import { buildKbInquiryContext } from "@/lib/rfq/kbInquiryContext";

export type KbInquiryMessage = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are the RFQ Assistant inquiry agent for automotive and industrial procurement teams.

Primary job: help buyers compare Word-extracted RFQ packages (RFQ1, RFQ2, …) and spot field-level differences in forms, attachments, and section data.

Rules for comparisons:
- Use RFQ labels (RFQ1, RFQ2) from the package index.
- For supplier/commercial questions, read supplier_and_commercial_sections and section 1.3 Supplier Request Form data.
- Compare field names AND values side by side (e.g. Supplier Name: blank vs "TEST").
- Template underscores or empty strings are NOT the same as filled values — call out filled vs blank explicitly.
- If one RFQ has a value and another does not, that IS a difference — never say forms are identical without checking each field.
- Quote exact extracted values; cite section numbers and rfq_label.
- If attachment_forms.clean_text or fields[] show a discrepancy, describe it in detail.

For single-RFQ questions, answer from the primary or full extraction blocks.
If data is missing, say which section/attachment would contain it. Do not invent values.`;

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

  const context = await buildKbInquiryContext({ sessionId, packageId, messages });
  const client = new OpenAI({ apiKey });

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Reference context (extracted RFQ packages for inquiry and comparison):\n\n${context}`,
    },
    {
      role: "assistant",
      content:
        "I have field-level extraction for all RFQ packages. Ask me to compare RFQ1 vs RFQ2, supplier forms, section fields, or attachment differences.",
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
