import type { MatchCriteria } from "@/lib/rfq/loadHistoricalKnowledge";

function firstLineItem(parsed: Record<string, unknown>): Record<string, unknown> | null {
  const items = parsed.line_items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const row = items[0];
  return typeof row === "object" && row !== null ? (row as Record<string, unknown>) : null;
}

function parseLineItems(parsed: Record<string, unknown>): Record<string, unknown>[] {
  const items = parsed.line_items;
  if (!Array.isArray(items)) return [];
  return items.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function mapParsedToMatchCriteria(parsed: Record<string, unknown>): MatchCriteria {
  const li = firstLineItem(parsed);
  const proc =
    (typeof li?.process === "string" ? li.process : null) ??
    (Array.isArray(parsed.process_family) && typeof parsed.process_family[0] === "string"
      ? (parsed.process_family[0] as string)
      : null);

  return {
    customer: typeof parsed.customer === "string" ? parsed.customer : null,
    program: typeof parsed.program === "string" ? parsed.program : null,
    material:
      (typeof li?.material_grade === "string" ? li.material_grade : null) ??
      (typeof parsed.material_grade === "string" ? parsed.material_grade : null),
    process: proc,
    part_name:
      (typeof li?.part_name === "string" ? li.part_name : null) ??
      (typeof parsed.part_name === "string" ? parsed.part_name : null),
    part_number:
      (typeof li?.part_number === "string" ? li.part_number : null) ??
      (typeof parsed.part_number === "string" ? parsed.part_number : null),
    annual_volume:
      (typeof li?.annual_volume === "number" ? li.annual_volume : null) ??
      (typeof parsed.annual_volume === "number" ? parsed.annual_volume : null),
    thickness_mm:
      (typeof li?.thickness_mm === "number" ? li.thickness_mm : null) ??
      (typeof parsed.thickness_mm === "number" ? parsed.thickness_mm : null),
    specs_text: typeof parsed.spec_text === "string" ? parsed.spec_text : null,
    feature_text: typeof li?.notes === "string" ? li.notes : null,
  };
}

/**
 * Builds one match criteria per parsed line item (preferred for multi-line RFQs/workbooks).
 */
export function mapParsedLineItemsToMatchCriteria(parsed: Record<string, unknown>): MatchCriteria[] {
  const customer = strOrNull(parsed.customer);
  const program = strOrNull(parsed.program);
  const fallbackProcess =
    Array.isArray(parsed.process_family) && typeof parsed.process_family[0] === "string"
      ? (parsed.process_family[0] as string)
      : null;
  const fallbackMaterial = strOrNull(parsed.material_grade);
  const fallbackPartName = strOrNull(parsed.part_name);
  const fallbackPartNumber = strOrNull(parsed.part_number);
  const fallbackAnnualVolume = numOrNull(parsed.annual_volume);
  const fallbackThickness = numOrNull(parsed.thickness_mm);

  const perItem = parseLineItems(parsed).map((li) => ({
    customer,
    program,
    material: strOrNull(li.material_grade) ?? fallbackMaterial,
    process: strOrNull(li.process) ?? fallbackProcess,
    part_name: strOrNull(li.part_name) ?? fallbackPartName,
    part_number: strOrNull(li.part_number) ?? fallbackPartNumber,
    annual_volume: numOrNull(li.annual_volume) ?? fallbackAnnualVolume,
    thickness_mm: numOrNull(li.thickness_mm) ?? fallbackThickness,
    feature_text: strOrNull(li.notes),
  }));

  if (perItem.length > 0) return perItem;
  return [mapParsedToMatchCriteria(parsed)];
}
