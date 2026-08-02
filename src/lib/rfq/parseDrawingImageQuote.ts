import OpenAI from "openai";
import sharp from "sharp";
import type { ParsedRfqWorkbook, WorkbookHeader, WorkbookLineItem } from "@/lib/rfq/parseRfqWorkbook";
import type { ParsedBomPartRow } from "@/lib/rfq/parseBomPartsWorkbook";
import type { RfqExtraInfoSheet } from "@/lib/rfq/parseBomPartsAsRfqWorkbook";

export type DrawingBomRow = {
  part_name: string;
  reference: string | null;
  tb_part_number: string | null;
  supplier_part_number: string | null;
  supplier: string | null;
  quantity: number | null;
  note: string | null;
};

export type DrawingExtractionResult = {
  header: {
    part_number: string | null;
    part_name: string | null;
    customer: string | null;
  };
  bom: DrawingBomRow[];
  specs: { label: string; value: string }[];
};

const SYSTEM = `You are a technical-drawing extraction assistant for automotive/electronics component
drawings (e.g. PCB assembly, wiring harness, connector drawings). The image may contain Japanese and
English text side by side — prefer the English text when both are present for the same field, but
if only Japanese text exists for a value, transliterate/translate it briefly.

Extract:
1. Title-block header: the drawing/part number (e.g. "F3040-X1092-B"), the part name/description
   (e.g. "CIRCUIT ASSY. ILLUMINATION"), and the manufacturer/company name shown on the drawing.
2. The composition / BOM table (may be titled "Composition Part List", "Parts List", "BOM", or similar):
   one row per component — part name, reference designator (if shown), the drawing-owner's part
   number, the supplier's part number (if different), supplier name, quantity, and any note/remark
   column content.
3. Any rated/application-condition or electrical/mechanical specification table (voltage, current,
   temperature range, dimensions, etc.) as a flat list of { label, value } pairs.

Do not guess values that are not clearly shown. Use null for fields you cannot read. Return JSON only,
no markdown.`;

const USER_INSTRUCTIONS = `Output a single JSON object with exactly these keys:
header: { part_number (string|null), part_name (string|null), customer (string|null) },
bom: array of { part_name (string), reference (string|null), tb_part_number (string|null), supplier_part_number (string|null), supplier (string|null), quantity (number|null), note (string|null) },
specs: array of { label (string), value (string) }.`;

function parseJsonObject(raw: string): DrawingExtractionResult {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as DrawingExtractionResult;
}

/**
 * Sends a technical-drawing image (TIFF, converted to PNG since OpenAI's vision input
 * doesn't accept TIFF directly) to a vision-capable model and returns the raw extracted
 * fields. This is the one impure, unmocked-in-tests boundary — see
 * mapDrawingExtractionToWorkbook for the pure, tested mapping logic that consumes its output.
 */
export async function extractDrawingFields(buffer: Buffer, apiKey: string): Promise<DrawingExtractionResult> {
  // failOn: "none" — some real-world TIFFs (e.g. CAD exports) have minor metadata tag
  // issues (truncated DateTime/Artist fields) that sharp's default strictness treats as
  // fatal; the actual image data reads fine, so tolerate the warning rather than reject.
  const pngBuffer = await sharp(buffer, { failOn: "none" }).png().toBuffer();
  const b64 = pngBuffer.toString("base64");
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL_PDF?.trim() || "gpt-4o";

  const res = await client.responses.create({
    model,
    temperature: 0.2,
    instructions: SYSTEM,
    input: [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: `data:image/png;base64,${b64}`, detail: "high" },
          { type: "input_text", text: USER_INSTRUCTIONS },
        ],
      },
    ],
  });

  const raw = res.output_text?.trim() ?? "";
  return parseJsonObject(raw);
}

function drawingRowToLineItem(row: DrawingBomRow): WorkbookLineItem {
  return {
    item: row.reference || row.tb_part_number || row.part_name,
    part_name: row.part_name,
    system: row.supplier ?? "",
    subsystem: row.tb_part_number ?? row.supplier_part_number ?? "",
    level: "",
    material: "",
    process: "",
    target_price: null,
    tooling: "",
    thickness_mm: null,
    annual_volume: null,
  };
}

function drawingRowToBomPartRow(row: DrawingBomRow, sourceLabel: string, index: number): ParsedBomPartRow {
  const ref_designator =
    row.reference || row.tb_part_number || row.supplier_part_number || row.part_name.slice(0, 40);
  const extended: Record<string, string> = {};
  if (row.supplier) extended.supplier = row.supplier;
  if (row.supplier_part_number) extended.supplier_part_number = row.supplier_part_number;
  if (row.note) extended.note = row.note;

  return {
    supplier_id: null,
    customer_program: null,
    sub_assembly: null,
    ref_designator,
    description: row.part_name || null,
    quantity: row.quantity,
    unit_cost: null,
    currency: "USD",
    mfr_part_number: row.tb_part_number || row.supplier_part_number || null,
    extended_attributes_json: Object.keys(extended).length > 0 ? JSON.stringify(extended) : null,
    raw_source_ref: `${sourceLabel}!drawing!row${index + 1}`,
  };
}

/**
 * Maps a vision model's raw drawing extraction into the same ParsedRfqWorkbook shape
 * the other upload adapters produce, so it flows through the existing RFQ analysis
 * pipeline (and is matched against other uploaded RFQs) unmodified. There is no pricing
 * data on a component drawing, so target_price/unit_cost are always null here — that's
 * an honest reflection of the source, not a mapping gap. Specs (ratings, dimensions)
 * have no equivalent RFQ field, so they're returned as extraInfo for read-only display,
 * reusing the same Overview card built for the BOM-parts-as-RFQ-upload feature.
 *
 * WorkbookHeader has no distinct "program"/part-name field — workbookToAgentParsed.ts
 * computes the displayed `program` as `[header.region, header.sop].join(" · ") ||
 * header.rfq_id`. This adapter repurposes `region` to carry the drawing's part
 * name/description (not geography) and `rfq_id` to carry the drawing/part number,
 * matching the pattern already used by parseAagSingleSheetQuote.ts.
 */
export function mapDrawingExtractionToWorkbook(
  extraction: DrawingExtractionResult,
  sourceLabel = "upload",
): {
  workbook: ParsedRfqWorkbook;
  extraInfo: RfqExtraInfoSheet[];
  bomPartsRows: ParsedBomPartRow[];
} {
  const bomRows = Array.isArray(extraction.bom) ? extraction.bom.filter((r) => r && r.part_name) : [];

  const header: WorkbookHeader = {
    rfq_id: extraction.header?.part_number || "",
    customer: extraction.header?.customer || "",
    region: extraction.header?.part_name || "",
    annual_volume: 0,
    currency: "USD",
    sop: "",
  };

  const workbook: ParsedRfqWorkbook = {
    header,
    line_items: bomRows.map(drawingRowToLineItem),
    technical_specs: [],
    supplier_responses: [],
    suppliers_grouped: [],
  };

  const extraInfo: RfqExtraInfoSheet[] = [];
  if (Array.isArray(extraction.specs) && extraction.specs.length > 0) {
    extraInfo.push({
      sheet: "Specifications",
      rows: extraction.specs
        .filter((s) => s && s.label)
        .map((s) => ({ Label: s.label, Value: s.value ?? "" })),
    });
  }

  const bomPartsRows = bomRows.map((row, i) => drawingRowToBomPartRow(row, sourceLabel, i));

  return { workbook, extraInfo, bomPartsRows };
}
