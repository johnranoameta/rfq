import { PDFParse } from "pdf-parse";

/**
 * Best-effort text layer extraction. Empty or tiny text usually means scanned pages
 * (or image-only PDFs).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text ?? "").replace(/\0/g, "").trim();
  } finally {
    await parser.destroy();
  }
}
