import type { MatchCriteria } from "@/lib/rfq/loadHistoricalKnowledge";

function firstLineItem(parsed: Record<string, unknown>): Record<string, unknown> | null {
  const items = parsed.line_items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const row = items[0];
  return typeof row === "object" && row !== null ? (row as Record<string, unknown>) : null;
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
    annual_volume:
      (typeof li?.annual_volume === "number" ? li.annual_volume : null) ??
      (typeof parsed.annual_volume === "number" ? parsed.annual_volume : null),
  };
}
