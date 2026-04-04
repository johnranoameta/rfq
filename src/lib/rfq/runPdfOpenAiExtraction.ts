import OpenAI from "openai";

import { extractPdfText } from "@/lib/rfq/extractPdfText";
import {
  extractRfqFromPdfBuffer,
  extractRfqFromText,
  MIN_CHARS_TEXT_PATH,
} from "@/lib/rfq/openaiRfqExtract";

export type PdfExtractionResult = {
  mode: "text_extract_openai" | "openai_pdf_input";
  model: string;
  extractedTextChars: number;
  parsed: Record<string, unknown>;
  raw: string;
};

export async function runPdfOpenAiExtraction(params: {
  buffer: Buffer;
  storedName: string;
  apiKey: string;
}): Promise<PdfExtractionResult> {
  const { buffer, storedName, apiKey } = params;
  const client = new OpenAI({ apiKey });
  const modelPdf = process.env.OPENAI_MODEL_PDF?.trim() || "gpt-4o";
  const modelText = process.env.OPENAI_MODEL_TEXT?.trim() || "gpt-4o-mini";

  let extractedText = "";
  try {
    extractedText = await extractPdfText(buffer);
  } catch {
    extractedText = "";
  }

  const useTextPath = extractedText.length >= MIN_CHARS_TEXT_PATH;

  if (useTextPath) {
    const { parsed, raw } = await extractRfqFromText(client, extractedText, modelText);
    return {
      mode: "text_extract_openai",
      model: modelText,
      extractedTextChars: extractedText.length,
      parsed,
      raw,
    };
  }

  const { parsed, raw } = await extractRfqFromPdfBuffer(client, buffer, storedName, modelPdf);
  return {
    mode: "openai_pdf_input",
    model: modelPdf,
    extractedTextChars: extractedText.length,
    parsed,
    raw,
  };
}
