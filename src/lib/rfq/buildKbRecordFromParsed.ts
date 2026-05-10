import type { HistoricalProjectRecord } from "@/lib/rfq/historicalKnowledgeTypes";

function firstLineItem(parsed: Record<string, unknown>): Record<string, unknown> | null {
  const items = parsed.line_items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const row = items[0];
  return typeof row === "object" && row !== null ? (row as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

function normalizeProjectId(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 64);
}

/** Use supplier quotes when present (workbook) to populate synthetic quote_result. */
function inferQuoteFromParsed(parsed: Record<string, unknown>): { piece: number; tooling: number } {
  const flat = parsed.supplier_responses_flat;
  if (!Array.isArray(flat)) return { piece: 0, tooling: 0 };
  const prices: number[] = [];
  for (const row of flat) {
    if (!row || typeof row !== "object") continue;
    const q = (row as Record<string, unknown>).quoted_price;
    if (typeof q === "number" && q > 0) prices.push(q);
  }
  if (prices.length === 0) return { piece: 0, tooling: 0 };
  prices.sort((a, b) => a - b);
  const piece = prices[Math.floor(prices.length / 2)]!;
  return { piece, tooling: 0 };
}

/**
 * Builds a {@link HistoricalProjectRecord} from normalized parse output (PDF model extract or workbook)
 * so uploads can be merged into the KB for future `rankHistoricalMatches` calls.
 */
export function buildKbRecordFromParsed(
  sessionId: string,
  parsed: Record<string, unknown>,
  opts: { originalFilename: string; source: "pdf" | "workbook" },
): HistoricalProjectRecord {
  const li = firstLineItem(parsed);
  const compactId = sessionId.replace(/-/g, "").slice(0, 12);
  const rfqRef = str(parsed.rfq_reference);
  const project_id = normalizeProjectId(rfqRef) || `U-${compactId}`;

  const fromPf =
    Array.isArray(parsed.process_family) && typeof parsed.process_family[0] === "string"
      ? (parsed.process_family[0] as string)
      : "";
  const processStr = (li && typeof li.process === "string" ? li.process : null) ?? fromPf;

  const inferred = inferQuoteFromParsed(parsed);
  const lineTarget =
    li && typeof (li as Record<string, unknown>).target_price === "number"
      ? num((li as Record<string, unknown>).target_price)
      : 0;
  const piece = inferred.piece > 0 ? inferred.piece : lineTarget;

  return {
    project_id,
    rfq: {
      customer: str(parsed.customer),
      program: str(parsed.program),
      part_name: str(li?.part_name ?? parsed.part_name),
      part_number: str(li?.part_number ?? parsed.part_number),
      process: processStr || "—",
      material: str(li?.material_grade ?? parsed.material_grade),
      thickness_mm: num(li?.thickness_mm ?? parsed.thickness_mm),
      annual_volume: num(li?.annual_volume ?? parsed.annual_volume),
      general_tolerance_mm: num(li?.general_tolerance_mm ?? parsed.general_tolerance_mm),
      ppap_level: num(li?.ppap_level ?? parsed.ppap_level),
      incoterm: str(parsed.incoterm),
      payment_terms: str(parsed.payment_terms),
      annual_reduction_pct: num(parsed.annual_reduction_pct),
    },
    quote_result: {
      packaging_cost_per_pc: 0.08,
      quoted_piece_price_usd: piece,
      tooling_cost_usd: inferred.tooling,
      award_result: piece > 0 ? "Uploaded" : "Pending",
    },
    notes: `KB upload (${opts.source}): ${opts.originalFilename}`,
  };
}
