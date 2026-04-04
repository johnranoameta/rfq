import OpenAI from "openai";

/** Enough text to prefer the cheap text-only model instead of uploading the PDF again. */
export const MIN_CHARS_TEXT_PATH = 400;

const SYSTEM = `You are an RFQ extraction assistant for automotive / industrial supplier quotes.
Extract structured fields from the RFQ content. Do not guess values that are not clearly supported by the document.
Return JSON only, no markdown.

Rules:
- Multi-line RFQs: populate line_items with one object per quoted line / part row in the schedule table. Use header-level fields for document-wide commercial terms.
- Use null for unknown scalar fields.
- required_attachments: list each attachment the RFQ mentions or checklist includes, with type and included (true if stated as included/received, false if missing or not provided).
- missing_references: file names or doc IDs referenced in the body but not present in the package, if inferable; else [].
- document_completeness: "complete" | "incomplete" | "missing" based on whether required attachments appear satisfied.
- rfq_case: a short label like "A", "B", or "unknown" if not applicable.
- process_family: string array (may be empty); can mirror the primary process from line 1 if one family applies.
- Dates: ISO YYYY-MM-DD or null.
`;

const USER_SUFFIX = `

Output a single JSON object with exactly these keys:
rfq_reference (string|null), issue_date (string|null), response_due_date (string|null), quote_valid_until (string|null),
rfq_case (string), document_completeness (string), customer (string|null), program (string|null),
part_name (string|null), part_number (string|null), process_family (array of strings),
material_grade (string|null), thickness_mm (number|null), annual_volume (number|null),
sop_date (string|null), general_tolerance_mm (number|null), ppap_level (number|null),
incoterm (string|null), payment_terms (string|null), annual_reduction_pct (number|null),
line_items (array of { line_no (number), part_number (string), part_name (string), material_grade (string|null), process (string|null), annual_volume (number|null), sop_date (string|null), general_tolerance_mm (number|null), notes (string|null) }),
required_attachments (array of { file_name, type, included }),
missing_references (array of strings).`;

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

export async function extractRfqFromText(
  client: OpenAI,
  text: string,
  model: string,
): Promise<{ parsed: Record<string, unknown>; raw: string }> {
  const body = text.length > 120_000 ? text.slice(0, 120_000) + "\n\n[truncated]" : text;
  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `RFQ document text:\n\n${body}${USER_SUFFIX}` },
    ],
  });
  const raw = res.choices[0]?.message?.content?.trim() ?? "";
  return { parsed: parseJsonObject(raw), raw };
}

export async function extractRfqFromPdfBuffer(
  client: OpenAI,
  pdfBuffer: Buffer,
  filename: string,
  model: string,
): Promise<{ parsed: Record<string, unknown>; raw: string }> {
  const b64 = pdfBuffer.toString("base64");
  const res = await client.responses.create({
    model,
    temperature: 0.2,
    instructions: SYSTEM,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename,
            file_data: `data:application/pdf;base64,${b64}`,
          },
          {
            type: "input_text",
            text: `This PDF may be scanned (image-only pages). Read all pages and extract RFQ fields.${USER_SUFFIX}`,
          },
        ],
      },
    ],
  });
  const raw = res.output_text?.trim() ?? "";
  return { parsed: parseJsonObject(raw), raw };
}
