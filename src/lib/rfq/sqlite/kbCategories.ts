import { classifyKbClass } from "@/lib/rfq/kbCanonicalClasses";
import { normalizedKbLabelKey } from "@/lib/rfq/kbLabelNormalize";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

export type KbCategoryRow = {
  category_id: number;
  slug: string;
  label: string;
  letter: string;
  icon_bg: string;
  icon_fg: string;
  profile_id: string;
  blurb: string;
  source: string;
  sort_order: number;
  created_at: string;
};

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function colorsForSlug(slug: string): { icon_bg: string; icon_fg: string } {
  const hue = hashHue(slug);
  return {
    icon_bg: `hsl(${hue} 42% 94%)`,
    icon_fg: `hsl(${hue} 55% 28%)`,
  };
}

export function letterFromLabel(label: string): string {
  const t = label.trim();
  if (!t) return "?";
  const ch = t[0];
  return /[a-z]/i.test(ch) ? ch.toUpperCase() : "?";
}

export function listKbCategories(): KbCategoryRow[] {
  const db = getRfqDb();
  return db
    .prepare(
      `SELECT category_id, slug, label, letter, icon_bg, icon_fg, profile_id, blurb, source, sort_order, created_at
       FROM kb_categories
       ORDER BY sort_order ASC, category_id ASC`,
    )
    .all() as KbCategoryRow[];
}

export function getKbCategoryBySlug(slug: string): KbCategoryRow | undefined {
  const db = getRfqDb();
  return db
    .prepare(
      `SELECT category_id, slug, label, letter, icon_bg, icon_fg, profile_id, blurb, source, sort_order, created_at
       FROM kb_categories WHERE slug = ?`,
    )
    .get(slug) as KbCategoryRow | undefined;
}

/** Prefer system seed rows over AI duplicates when labels match after normalization. */
export function findKbCategoryByNormalizedLabel(
  categories: KbCategoryRow[],
  label: string,
): KbCategoryRow | undefined {
  const key = normalizedKbLabelKey(label);
  if (!key) return undefined;
  const hits = categories.filter((c) => normalizedKbLabelKey(c.label) === key);
  if (hits.length === 0) return undefined;
  hits.sort((a, b) => {
    if (a.source === "system" && b.source !== "system") return -1;
    if (b.source === "system" && a.source !== "system") return 1;
    return a.sort_order - b.sort_order || a.category_id - b.category_id;
  });
  return hits[0];
}

/** Insert AI- or user-derived category; returns full row. */
export function insertKbCategory(params: {
  slug: string;
  label: string;
  profile_id?: string;
  blurb?: string;
}): KbCategoryRow {
  const db = getRfqDb();
  const slug = params.slug.trim().toLowerCase();
  const label = params.label.trim();
  const all = listKbCategories();
  const dupLabel = findKbCategoryByNormalizedLabel(all, label);
  if (dupLabel) return dupLabel;

  const { icon_bg, icon_fg } = colorsForSlug(slug);
  const letter = letterFromLabel(label);
  const maxRow = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM kb_categories`).get() as { m: number };
  const sort_order = maxRow.m + 1;
  const profile_id = params.profile_id?.trim() || `ai_${slug}_v1`;
  const blurb = params.blurb?.trim() || `Procurement class “${label}”. Created from RFQ classification.`;

  db.prepare(
    `INSERT INTO kb_categories (slug, label, letter, icon_bg, icon_fg, profile_id, blurb, source, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ai', ?)`,
  ).run(slug, label, letter, icon_bg, icon_fg, profile_id, blurb, sort_order);

  const row = getKbCategoryBySlug(slug);
  if (!row) throw new Error("Failed to read inserted kb_category");
  return row;
}

/** Ensure slug exists (e.g. after AI returns a known slug). Creates row only if missing. */
export function ensureKbCategorySlug(params: {
  slug: string;
  label: string;
  profile_id?: string;
  blurb?: string;
}): KbCategoryRow {
  const existing = getKbCategoryBySlug(params.slug);
  if (existing) return existing;
  const all = listKbCategories();
  const sameLabel = findKbCategoryByNormalizedLabel(all, params.label);
  if (sameLabel) return sameLabel;
  return insertKbCategory(params);
}

export function legacyClassifySlug(row: {
  process_family: string;
  part_name: string;
  program_name: string;
}): string {
  return classifyKbClass(row);
}
