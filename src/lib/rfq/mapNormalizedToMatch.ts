import type { NormalizedPackage } from "@/lib/extraction/normalizedTypes";
import type { MatchCriteria } from "@/lib/rfq/loadHistoricalKnowledge";

function isBlankValue(value: string): boolean {
  const v = value.trim();
  return !v || /^_+$/.test(v);
}

/** Case-insensitive field index from all section_slots (first non-blank wins). */
export function indexNormalizedFields(pkg: NormalizedPackage): Map<string, string> {
  const map = new Map<string, string>();
  for (const slot of pkg.section_slots ?? []) {
    for (const row of slot.fields ?? []) {
      const key = row.field.trim().toLowerCase();
      const val = (row.value ?? "").trim();
      if (isBlankValue(val)) continue;
      if (!map.has(key)) map.set(key, val);
    }
  }
  return map;
}

function pickField(map: Map<string, string>, ...names: string[]): string | null {
  for (const name of names) {
    const v = map.get(name.toLowerCase());
    if (v && !isBlankValue(v)) return v;
  }
  return null;
}

function parseNum(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function inferProcess(pkg: NormalizedPackage, fields: Map<string, string>): string | null {
  const fromFields = pickField(fields, "process", "process family", "commodity / package description");
  if (fromFields) return fromFields;
  if (pkg.title?.toLowerCase().includes("powertrain")) return "powertrain";
  return null;
}

function technicalSpecsText(pkg: NormalizedPackage): string | null {
  const chunks: string[] = [];
  for (const slot of pkg.section_slots ?? []) {
    const label = `${slot.section_number ?? ""} ${slot.section_display ?? slot.section_title ?? ""}`.toLowerCase();
    if (!label.includes("technical") && !label.includes("spec") && slot.section_number !== "1") continue;
    const body = (slot.body_text ?? "").trim();
    if (body) chunks.push(body.slice(0, 4000));
    for (const f of slot.expected_files ?? []) {
      if (f.present && f.clean_text?.trim()) chunks.push(f.clean_text.slice(0, 2000));
    }
  }
  const joined = chunks.join("\n").trim();
  return joined || null;
}

export type NormalizedMatchItem = {
  item_index: number;
  item_label: string;
  part_name: string | null;
  criteria: MatchCriteria;
};

/**
 * Build match criteria from Word-normalized extraction (section field tables).
 * One package-level item today; extend when multi-part tables are parsed per line.
 */
export function mapNormalizedToMatchItems(pkg: NormalizedPackage): NormalizedMatchItem[] {
  const fields = indexNormalizedFields(pkg);

  const partNumber =
    pickField(fields, "gm part number", "part number", "engineering part number", "pn") ?? null;
  const partName =
    pickField(fields, "part description", "commodity / package description", "description") ??
    pkg.title ??
    pkg.filename ??
    null;
  const program = pickField(fields, "vehicle program", "program", "program / sourcing id") ?? null;
  const material = pickField(fields, "material grade", "material", "material specification") ?? null;
  const customer =
    pickField(fields, "customer", "contracting buyer entities", "business unit", "company name") ?? null;
  const annualVolume = parseNum(pickField(fields, "annual volume", "volume"));
  const thickness = parseNum(
    pickField(fields, "thickness_mm", "thickness", "thickness (mm)", "general tolerance_mm"),
  );

  const criteria: MatchCriteria = {
    customer,
    program,
    material,
    process: inferProcess(pkg, fields),
    part_name: partName,
    part_number: partNumber,
    annual_volume: annualVolume,
    thickness_mm: thickness,
    specs_text: technicalSpecsText(pkg),
    feature_text: pickField(fields, "commodity / package description", "part description"),
  };

  const label = partNumber ?? partName?.slice(0, 40) ?? pkg.filename ?? "Package";

  return [
    {
      item_index: 0,
      item_label: label,
      part_name: partName,
      criteria,
    },
  ];
}

export function mapNormalizedToMatchCriteria(pkg: NormalizedPackage): MatchCriteria {
  return mapNormalizedToMatchItems(pkg)[0]?.criteria ?? {};
}
