import type { GapAnalysisResult } from "@/lib/rfq/gapFromParsed";
import type { MatchCriteria, RankedHistoricalMatch } from "@/lib/rfq/loadHistoricalKnowledge";
import { getKbCategoryBySlug } from "@/lib/rfq/sqlite/kbCategories";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

function humanizeKbSlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

/**
 * Prefer `kb_categories` label for slug (canonical source). Drop stored label when it is only
 * the part display name (mis-tagged rows). Slugs without a row get a readable title from the slug.
 */
function resolveKbCategoryLabelForSession(
  slug: string | null | undefined,
  storedLabel: string | null | undefined,
  partDisplayName: string | null | undefined,
): string | null {
  const s = typeof slug === "string" ? slug.trim() : "";
  const stored = typeof storedLabel === "string" ? storedLabel.trim() : "";
  const part = typeof partDisplayName === "string" ? partDisplayName.trim() : "";
  if (s) {
    const cat = getKbCategoryBySlug(s);
    if (cat?.label?.trim()) return cat.label.trim();
    return humanizeKbSlug(s);
  }
  if (stored && part && stored.toLowerCase() === part.toLowerCase()) {
    return null;
  }
  return stored || null;
}

export type PersistedParsePayload = {
  mode: string;
  model: string;
  extractedTextChars: number;
  parsed: Record<string, unknown>;
  raw: string;
};

export type PersistedHistoricalPayload = {
  criteria: MatchCriteria;
  matches: RankedHistoricalMatch[];
  per_item_matches?: Array<{
    item_index: number;
    item_label: string;
    part_name: string | null;
    criteria: MatchCriteria;
    matches: RankedHistoricalMatch[];
  }>;
  meta: { candidatePool: number };
};

function strField(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function lineItemCount(parsed: Record<string, unknown>): number {
  const li = parsed.line_items;
  return Array.isArray(li) ? li.length : 0;
}

/**
 * One row per upload id (`session_id`); overwrites prior analysis for the same upload.
 */
export function upsertRfqParseSession(input: {
  sessionId: string;
  uploadId: string;
  originalFilename: string;
  storedFilename: string;
  parse: PersistedParsePayload;
  historical: PersistedHistoricalPayload;
  gap: GapAnalysisResult;
  kbCategory?: { slug: string; label: string } | null;
  partDisplayName?: string | null;
  processFamilyHint?: string | null;
}): void {
  const db = getRfqDb();
  const p = input.parse.parsed;
  const customer_name = strField(p.customer);
  const program_name = strField(p.program);
  const part_number = strField(p.part_number);
  const rfq_reference = strField(p.rfq_reference);
  const risk_score = input.gap.risk_score;
  const line_item_count = lineItemCount(p);
  const parse_json = JSON.stringify(input.parse);
  const historical_json = JSON.stringify(input.historical);
  const gap_json = JSON.stringify(input.gap);
  const kb_category_slug = input.kbCategory?.slug?.trim() || null;
  const kb_category_label = input.kbCategory?.label?.trim() || null;
  const part_display_name =
    input.partDisplayName?.trim() ||
    (typeof p.part_name === "string" ? p.part_name.trim() : null) ||
    null;
  const pf = p.process_family;
  const process_family_hint =
    input.processFamilyHint?.trim() ||
    (Array.isArray(pf) ? pf.map(String).join(", ") : typeof pf === "string" ? pf.trim() : null) ||
    null;

  db.prepare(
    `INSERT INTO rfq_parse_sessions (
      session_id, upload_id, original_filename, stored_filename,
      customer_name, program_name, part_number, rfq_reference, risk_score, line_item_count,
      parse_json, historical_json, gap_json,
      kb_category_slug, kb_category_label, part_display_name, process_family_hint
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      upload_id = excluded.upload_id,
      original_filename = excluded.original_filename,
      stored_filename = excluded.stored_filename,
      customer_name = excluded.customer_name,
      program_name = excluded.program_name,
      part_number = excluded.part_number,
      rfq_reference = excluded.rfq_reference,
      risk_score = excluded.risk_score,
      line_item_count = excluded.line_item_count,
      parse_json = excluded.parse_json,
      historical_json = excluded.historical_json,
      gap_json = excluded.gap_json,
      kb_category_slug = excluded.kb_category_slug,
      kb_category_label = excluded.kb_category_label,
      part_display_name = excluded.part_display_name,
      process_family_hint = excluded.process_family_hint`,
  ).run(
    input.sessionId,
    input.uploadId,
    input.originalFilename,
    input.storedFilename,
    customer_name,
    program_name,
    part_number,
    rfq_reference,
    risk_score,
    line_item_count,
    parse_json,
    historical_json,
    gap_json,
    kb_category_slug,
    kb_category_label,
    part_display_name,
    process_family_hint,
  );
}

export type RfqParseSessionRow = {
  session_id: string;
  upload_id: string;
  original_filename: string;
  stored_filename: string;
  customer_name: string | null;
  program_name: string | null;
  part_number: string | null;
  rfq_reference: string | null;
  risk_score: number | null;
  line_item_count: number;
  created_at: string;
  kb_category_slug: string | null;
  kb_category_label: string | null;
  part_display_name: string | null;
  process_family_hint: string | null;
};

export function listRfqParseSessionSummaries(): RfqParseSessionRow[] {
  const db = getRfqDb();
  return db
    .prepare(
      `SELECT session_id, upload_id, original_filename, stored_filename,
              customer_name, program_name, part_number, rfq_reference, risk_score, line_item_count, created_at,
              kb_category_slug, kb_category_label, part_display_name, process_family_hint
       FROM rfq_parse_sessions
       ORDER BY datetime(created_at) DESC`,
    )
    .all() as RfqParseSessionRow[];
}

export type RfqParseSessionFull = RfqParseSessionRow & {
  parse: PersistedParsePayload;
  historical: PersistedHistoricalPayload;
  gap: GapAnalysisResult;
};

/** Removes a persisted PDF analysis row. Does not delete files from `.uploads/`. */
export function deleteRfqParseSession(sessionId: string): boolean {
  const db = getRfqDb();
  const r = db.prepare(`DELETE FROM rfq_parse_sessions WHERE session_id = ?`).run(sessionId);
  return r.changes > 0;
}

export function getRfqParseSession(sessionId: string): RfqParseSessionFull | null {
  const db = getRfqDb();
  const row = db
    .prepare(`SELECT * FROM rfq_parse_sessions WHERE session_id = ?`)
    .get(sessionId) as
    | (RfqParseSessionRow & {
        parse_json: string;
        historical_json: string;
        gap_json: string;
      })
    | undefined;
  if (!row) return null;
  const kbSlug = row.kb_category_slug ?? null;
  const kbLabel = resolveKbCategoryLabelForSession(
    kbSlug,
    row.kb_category_label ?? null,
    row.part_display_name ?? null,
  );
  return {
    session_id: row.session_id,
    upload_id: row.upload_id,
    original_filename: row.original_filename,
    stored_filename: row.stored_filename,
    customer_name: row.customer_name,
    program_name: row.program_name,
    part_number: row.part_number,
    rfq_reference: row.rfq_reference,
    risk_score: row.risk_score,
    line_item_count: row.line_item_count,
    created_at: row.created_at,
    kb_category_slug: kbSlug,
    kb_category_label: kbLabel,
    part_display_name: row.part_display_name ?? null,
    process_family_hint: row.process_family_hint ?? null,
    parse: JSON.parse(row.parse_json) as PersistedParsePayload,
    historical: JSON.parse(row.historical_json) as PersistedHistoricalPayload,
    gap: JSON.parse(row.gap_json) as GapAnalysisResult,
  };
}
