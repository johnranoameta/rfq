import {
  ensureKbCategorySlug,
  findKbCategoryByNormalizedLabel,
  legacyClassifySlug,
  listKbCategories,
} from "@/lib/rfq/sqlite/kbCategories";
import { kbMetaById, type KbClassId } from "@/lib/rfq/kbCanonicalClasses";
import { runOpenAiKbCategoryAssignment, summarizeParsedForKbCategory } from "@/lib/rfq/openaiKbCategory";

export type KbAssignment = {
  slug: string;
  label: string;
  /** `model` = classifier with API key; `heuristic` = rules only. */
  source: "model" | "heuristic";
};

function processFamilyString(parsed: Record<string, unknown>): string {
  const pf = parsed.process_family;
  if (Array.isArray(pf)) return pf.map(String).join(", ");
  if (typeof pf === "string") return pf;
  return "";
}

function firstLinePartName(parsed: Record<string, unknown>): string | null {
  const li = parsed.line_items;
  if (!Array.isArray(li) || li.length === 0) return null;
  const row = li[0];
  if (typeof row !== "object" || row === null) return null;
  const pn = (row as Record<string, unknown>).part_name;
  return typeof pn === "string" ? pn : null;
}

export function partDisplayNameFromParsed(parsed: Record<string, unknown>): string | null {
  const top = typeof parsed.part_name === "string" ? parsed.part_name.trim() : "";
  if (top) return top;
  return firstLinePartName(parsed)?.trim() ?? null;
}

export function heuristicKbAssignment(parsed: Record<string, unknown>): KbAssignment {
  const part_name = partDisplayNameFromParsed(parsed) ?? "";
  const program_name = typeof parsed.program === "string" ? parsed.program : "";
  const process_family = processFamilyString(parsed);
  const legacy = legacyClassifySlug({ process_family, part_name, program_name }) as KbClassId;
  const meta = kbMetaById(legacy);
  return { slug: legacy, label: meta.label, source: "heuristic" };
}

/**
 * Classify parsed RFQ into a KB category: optional cloud model when apiKey is set (creates new DB rows as needed),
 * otherwise deterministic heuristic into one of the six canonical slugs.
 */
export async function assignKbCategoryForParsed(params: {
  parsed: Record<string, unknown>;
  apiKey?: string | null;
}): Promise<KbAssignment> {
  const existing = listKbCategories();
  if (!params.apiKey?.trim()) {
    const h = heuristicKbAssignment(params.parsed);
    const m = kbMetaById(h.slug as KbClassId);
    ensureKbCategorySlug({ slug: h.slug, label: h.label, profile_id: m.profileId, blurb: m.blurb });
    return h;
  }

  const summary = summarizeParsedForKbCategory(params.parsed);
  let ai: Awaited<ReturnType<typeof runOpenAiKbCategoryAssignment>>;
  try {
    ai = await runOpenAiKbCategoryAssignment({
      apiKey: params.apiKey.trim(),
      rfqSummary: summary,
      existing,
    });
  } catch {
    const h = heuristicKbAssignment(params.parsed);
    const m = kbMetaById(h.slug as KbClassId);
    ensureKbCategorySlug({ slug: h.slug, label: h.label, profile_id: m.profileId, blurb: m.blurb });
    return { ...h, source: "heuristic" };
  }

  const match = existing.find((c) => c.slug === ai.slug);
  if (match) {
    return { slug: match.slug, label: match.label, source: "model" };
  }

  const sameLabel = findKbCategoryByNormalizedLabel(existing, ai.label);
  if (sameLabel) {
    return { slug: sameLabel.slug, label: sameLabel.label, source: "model" };
  }

  const created = ensureKbCategorySlug({
    slug: ai.slug,
    label: ai.label,
    blurb: ai.rationale ? `AI: ${ai.rationale}` : undefined,
  });
  return { slug: created.slug, label: created.label, source: "model" };
}
