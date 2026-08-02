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

export type FractionalBox = { left: number; top: number; right: number; bottom: number };

type LocateResult = {
  header: { part_number: string | null; part_name: string | null; customer: string | null };
  bom_region: FractionalBox | null;
  specs_region: FractionalBox | null;
};

type ContentBlock =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "high" };

const LOCATE_SYSTEM = `You are a technical-drawing triage assistant for automotive/electronics component
drawings. This image is a low-resolution PREVIEW of a much larger page — you cannot read small print
reliably here, so do not attempt to. Your job is only to:
1. Read the title-block header, which typically uses larger text: the drawing/part number
   (e.g. "F3040-X1092-B"), the part name/description (e.g. "CIRCUIT ASSY. ILLUMINATION"), and the
   manufacturer/company name. The image may contain Japanese and English text side by side — prefer
   English when both are present.
2. Locate (do not read the contents of) the region containing the composition/BOM/parts-list table
   (may be titled "Component Parts List", "Composition Part List", "Parts List", "BOM", or similar).
3. Locate (do not read) the region containing any rated/application-condition or electrical/mechanical
   specification table (voltage, current, temperature range, dimensions, etc.).

Return each located region as a bounding box in FRACTIONS of the image width/height (0.0 = left/top
edge, 1.0 = right/bottom edge). Be generous — include comfortable margin around the table rather than
cropping tightly, since this box will be used to crop a higher-resolution version of the same page.
If a region does not appear on this page, return null for it. Return JSON only, no markdown.`;

const LOCATE_INSTRUCTIONS = `Output a single JSON object with exactly these keys:
header: { part_number (string|null), part_name (string|null), customer (string|null) },
bom_region: { left (number 0-1), top (number 0-1), right (number 0-1), bottom (number 0-1) } or null,
specs_region: { left (number 0-1), top (number 0-1), right (number 0-1), bottom (number 0-1) } or null.`;

const EXTRACT_SYSTEM = `You are a technical-drawing extraction assistant for automotive/electronics
component drawings. Each image below is a cropped, higher-resolution region from one drawing page —
read the small print carefully. The image may contain Japanese and English text side by side — prefer
English when both are present for the same field, but if only Japanese text exists for a value,
transliterate/translate it briefly.

Do not guess or invent values that are not clearly shown in the image. If a table's structure is
visible but a specific cell is illegible, use null for that field rather than fabricating a plausible-
looking value. If an expected table isn't actually present in the crop, return an empty array — do not
invent rows to fill the schema. Return JSON only, no markdown.`;

function buildExtractInstructions(askBom: boolean, askSpecs: boolean): string {
  const parts: string[] = ["Output a single JSON object with exactly these keys:"];
  parts.push(
    askBom
      ? "bom: array of { part_name (string), reference (string|null), tb_part_number (string|null), supplier_part_number (string|null), supplier (string|null), quantity (number|null), note (string|null) } — read every row from the parts/BOM table image."
      : "bom: [] (no parts/BOM table image was provided).",
  );
  parts.push(
    askSpecs
      ? "specs: array of { label (string), value (string) } — read every row from the specifications table image."
      : "specs: [] (no specifications table image was provided).",
  );
  return parts.join("\n");
}

function parseJsonObject<T>(raw: string): T {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}

/**
 * Converts a fractional bounding box (0-1) plus a symmetric padding margin into a pixel
 * rectangle clamped to the image bounds, for cropping the full-resolution image with
 * sharp's `.extract()`. Padding compensates for the localization pass being approximate.
 */
export function computeCropRect(
  box: FractionalBox,
  imageWidth: number,
  imageHeight: number,
  paddingFraction = 0.04,
): { left: number; top: number; width: number; height: number } {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  const left = clamp01(box.left - paddingFraction);
  const top = clamp01(box.top - paddingFraction);
  const right = clamp01(box.right + paddingFraction);
  const bottom = clamp01(box.bottom + paddingFraction);
  const pxLeft = Math.min(imageWidth - 1, Math.round(left * imageWidth));
  const pxTop = Math.min(imageHeight - 1, Math.round(top * imageHeight));
  const width = Math.max(1, Math.min(imageWidth - pxLeft, Math.round((right - left) * imageWidth)));
  const height = Math.max(1, Math.min(imageHeight - pxTop, Math.round((bottom - top) * imageHeight)));
  return { left: pxLeft, top: pxTop, width, height };
}

/**
 * Sends a technical-drawing image (TIFF, converted to PNG since OpenAI's vision input
 * doesn't accept TIFF directly) to a vision-capable model and returns the extracted fields.
 * This is the one impure, unmocked-in-tests boundary — see mapDrawingExtractionToWorkbook
 * for the pure, tested mapping logic that consumes its output.
 *
 * Two passes, not one: a full CAD-drawing page (often 10000+px on a side) sent as a single
 * image gets downscaled by OpenAI's vision input to a fixed budget (~2048px), which crushes
 * a dense parts-list table's small print into illegibility — observed in practice to cause
 * the model to fabricate plausible-looking rows rather than read real ones. Pass 1 sends a
 * deliberately low-res preview just to read the (larger) title-block text and locate the
 * BOM/specs table regions; pass 2 crops those regions from the FULL-resolution image (so
 * each crop gets its own ~2048px budget) and reads them in detail.
 */
export async function extractDrawingFields(buffer: Buffer, apiKey: string): Promise<DrawingExtractionResult> {
  // failOn: "none" — some real-world TIFFs (e.g. CAD exports) have minor metadata tag
  // issues (truncated DateTime/Artist fields) that sharp's default strictness treats as
  // fatal; the actual image data reads fine, so tolerate the warning rather than reject.
  const fullPng = await sharp(buffer, { failOn: "none" }).png().toBuffer();
  const meta = await sharp(fullPng).metadata();
  const imageWidth = meta.width ?? 0;
  const imageHeight = meta.height ?? 0;

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL_PDF?.trim() || "gpt-4o";

  const previewPng = await sharp(fullPng)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  const locateRes = await client.responses.create({
    model,
    temperature: 0.2,
    instructions: LOCATE_SYSTEM,
    input: [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: `data:image/png;base64,${previewPng.toString("base64")}`, detail: "high" },
          { type: "input_text", text: LOCATE_INSTRUCTIONS },
        ],
      },
    ],
  });
  const locate = parseJsonObject<LocateResult>(locateRes.output_text?.trim() ?? "");

  const content: ContentBlock[] = [];
  const askBom = Boolean(imageWidth && imageHeight && locate.bom_region);
  const askSpecs = Boolean(imageWidth && imageHeight && locate.specs_region);

  if (askBom && locate.bom_region) {
    const rect = computeCropRect(locate.bom_region, imageWidth, imageHeight);
    const cropPng = await sharp(fullPng).extract(rect).png().toBuffer();
    content.push({ type: "input_text", text: "Parts/BOM table region:" });
    content.push({ type: "input_image", image_url: `data:image/png;base64,${cropPng.toString("base64")}`, detail: "high" });
  }
  if (askSpecs && locate.specs_region) {
    const rect = computeCropRect(locate.specs_region, imageWidth, imageHeight);
    const cropPng = await sharp(fullPng).extract(rect).png().toBuffer();
    content.push({ type: "input_text", text: "Specifications table region:" });
    content.push({ type: "input_image", image_url: `data:image/png;base64,${cropPng.toString("base64")}`, detail: "high" });
  }

  let bom: DrawingBomRow[] = [];
  let specs: { label: string; value: string }[] = [];
  if (content.length > 0) {
    content.push({ type: "input_text", text: buildExtractInstructions(askBom, askSpecs) });
    const extractRes = await client.responses.create({
      model,
      temperature: 0.2,
      instructions: EXTRACT_SYSTEM,
      input: [{ role: "user", content }],
    });
    const parsed = parseJsonObject<{ bom?: DrawingBomRow[]; specs?: { label: string; value: string }[] }>(
      extractRes.output_text?.trim() ?? "",
    );
    bom = Array.isArray(parsed.bom) ? parsed.bom : [];
    specs = Array.isArray(parsed.specs) ? parsed.specs : [];
  }

  return {
    header: locate.header ?? { part_number: null, part_name: null, customer: null },
    bom,
    specs,
  };
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
