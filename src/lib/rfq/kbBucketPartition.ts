import { classifyKbClass } from "@/lib/rfq/kbCanonicalClasses";
import type { KbCategoryRow } from "@/lib/rfq/sqlite/kbCategories";
import type { SeedRfqProjectRow } from "@/lib/rfq/sqlite/seedRfqs";
import type { RfqParseSessionRow } from "@/lib/rfq/sqlite/parseSessions";

export type KbMainProjectRow = {
  rfq_id: number;
  session_id?: string;
  customer_name: string;
  program_name: string;
  part_name: string;
  part_number: string;
  process_family: string;
  material_grade: string | null;
  annual_volume: number | null;
  sop_date: string | null;
  rfq_case_code: string | null;
  created_at: string | null;
};

export type KbBucket = KbCategoryRow & { projects: KbMainProjectRow[] };

function seedRowSlug(s: SeedRfqProjectRow): string {
  if (s.kb_category_slug?.trim()) return s.kb_category_slug.trim();
  return classifyKbClass({
    process_family: s.process_family,
    part_name: s.part_name,
    program_name: s.program_name,
  });
}

function uploadRowSlug(u: RfqParseSessionRow, categories: KbCategoryRow[]): string {
  if (u.kb_category_slug?.trim()) {
    const slug = u.kb_category_slug.trim();
    if (categories.some((c) => c.slug === slug)) return slug;
  }
  return classifyKbClass({
    process_family: u.process_family_hint ?? "",
    part_name: u.part_display_name ?? "",
    program_name: u.program_name ?? "",
  });
}

function seedToKbRow(s: SeedRfqProjectRow): KbMainProjectRow {
  return {
    rfq_id: s.rfq_id,
    customer_name: s.customer_name,
    program_name: s.program_name,
    part_name: s.part_name,
    part_number: s.part_number,
    process_family: s.process_family,
    material_grade: s.material_grade,
    annual_volume: s.annual_volume,
    sop_date: s.sop_date,
    rfq_case_code: s.rfq_case_code,
    created_at: s.created_at,
  };
}

function uploadToKbRow(u: RfqParseSessionRow): KbMainProjectRow {
  return {
    rfq_id: 0,
    session_id: u.session_id,
    customer_name: u.customer_name ?? "",
    program_name: u.program_name ?? "",
    part_name: u.part_display_name?.trim() || "(from upload)",
    part_number: u.part_number ?? "",
    process_family: u.process_family_hint ?? "",
    material_grade: null,
    annual_volume: null,
    sop_date: null,
    rfq_case_code: null,
    created_at: u.created_at,
  };
}

export function partitionKbBuckets(
  categories: KbCategoryRow[],
  seeds: SeedRfqProjectRow[],
  uploads: RfqParseSessionRow[],
): KbBucket[] {
  return categories.map((cat) => {
    const projects: KbMainProjectRow[] = [];
    for (const s of seeds) {
      if (seedRowSlug(s) === cat.slug) projects.push(seedToKbRow(s));
    }
    for (const u of uploads) {
      if (uploadRowSlug(u, categories) === cat.slug) projects.push(uploadToKbRow(u));
    }
    return { ...cat, projects };
  });
}
