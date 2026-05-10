import OpenAI from "openai";

import type { KbCategoryRow } from "@/lib/rfq/sqlite/kbCategories";

const SYSTEM = `You are a procurement taxonomy assistant. Given an RFQ summary and a list of existing knowledge-base categories, either:
(1) choose the single best-matching existing category slug, or
(2) propose a new procurement category when none fit well (e.g. forging-only, composites, optics, textiles).

Rules:
- Prefer reusing an existing slug when it is a reasonable fit (avoid unnecessary new categories).
- If the RFQ fits an existing row, reuse that row's exact slug — do not invent a second slug for the same sidebar label (e.g. never add "casting_forging" when "casting" already exists with label "Casting / Forging").
- New slugs: lowercase snake_case, ASCII only, 3–40 chars (e.g. "composite_structures", "hydraulics_valves"). Only when no existing category is a reasonable match.
- Labels: short human title (2–6 words) for UI sidebars.
- Return JSON only, no markdown.

Required JSON shape:
{
  "slug": string,
  "label": string,
  "reused_existing": boolean,
  "rationale": string
}

"reused_existing" is true only if "slug" exactly matches one of the provided existing slugs.`;

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function normalizeSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export type OpenAiKbCategoryResult = {
  slug: string;
  label: string;
  reused_existing: boolean;
  rationale: string;
};

export function summarizeParsedForKbCategory(parsed: Record<string, unknown>): string {
  const parts: string[] = [];
  const cust = typeof parsed.customer === "string" ? parsed.customer : "";
  const prog = typeof parsed.program === "string" ? parsed.program : "";
  const pn = typeof parsed.part_name === "string" ? parsed.part_name : "";
  const pf = parsed.process_family;
  const proc =
    Array.isArray(pf) ? pf.join(", ") : typeof pf === "string" ? pf : "";
  const mat = typeof parsed.material_grade === "string" ? parsed.material_grade : "";
  if (cust) parts.push(`Customer: ${cust}`);
  if (prog) parts.push(`Program: ${prog}`);
  if (pn) parts.push(`Primary part: ${pn}`);
  if (proc) parts.push(`Process family: ${proc}`);
  if (mat) parts.push(`Material: ${mat}`);
  const li = parsed.line_items;
  if (Array.isArray(li) && li.length > 0) {
    const lines = li.slice(0, 8).map((row) => {
      if (typeof row !== "object" || row === null) return "";
      const r = row as Record<string, unknown>;
      const name = typeof r.part_name === "string" ? r.part_name : "";
      const p = typeof r.process === "string" ? r.process : "";
      const m = typeof r.material_grade === "string" ? r.material_grade : "";
      return [name, p, m].filter(Boolean).join(" · ");
    });
    parts.push(`Line items: ${lines.filter(Boolean).join(" | ")}`);
  }
  const wh = parsed.workbook_header;
  if (typeof wh === "object" && wh !== null) {
    const h = wh as Record<string, unknown>;
    const vol = h.annual_volume;
    if (typeof vol === "number" || typeof vol === "string") parts.push(`Annual volume: ${vol}`);
  }
  return parts.join("\n");
}

export async function runOpenAiKbCategoryAssignment(params: {
  apiKey: string;
  model?: string;
  rfqSummary: string;
  existing: KbCategoryRow[];
}): Promise<OpenAiKbCategoryResult> {
  const model = params.model?.trim() || process.env.OPENAI_KB_MODEL?.trim() || "gpt-4o-mini";
  const client = new OpenAI({ apiKey: params.apiKey });

  const existingLines = params.existing.map((c) => `- ${c.slug}: ${c.label}`).join("\n");
  const user = `Existing categories (slug: label):\n${existingLines || "(none)"}\n\nRFQ summary:\n${params.rfqSummary}`;

  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? "";
  const obj = parseJsonObject(raw);
  const slug = normalizeSlug(typeof obj.slug === "string" ? obj.slug : "");
  const label = typeof obj.label === "string" ? obj.label.trim() : "";
  if (!slug || !label) {
    throw new Error("KB category model returned empty slug or label");
  }
  return {
    slug,
    label: label.slice(0, 120),
    reused_existing: obj.reused_existing === true,
    rationale: typeof obj.rationale === "string" ? obj.rationale : "",
  };
}
