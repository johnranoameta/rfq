/**
 * Canonical knowledge-base classes (procurement “KB” buckets) shown in the assistant UI.
 * Rows are classified from process_family + part/program text so the sidebar stays stable
 * even when SQLite only stores coarse values like `stamping`.
 */

export type KbClassId = "electronics" | "machining" | "stamping" | "injection" | "assembly" | "casting";

export type KbClassMeta = {
  id: KbClassId;
  /** Sidebar + canvas title */
  label: string;
  letter: string;
  iconBg: string;
  iconFg: string;
  /** Short explanation in KB summary */
  blurb: string;
  /** Shown as “profile” id in the canvas */
  profileId: string;
};

export const KB_CLASS_ORDER: readonly KbClassMeta[] = [
  {
    id: "electronics",
    label: "Electronics Modules",
    letter: "E",
    iconBg: "#e8f2fc",
    iconFg: "#1a6fc4",
    profileId: "electronics_control_module_v2",
    blurb:
      "ECU, PCB assembly, gateways, sensors, and power electronics. Similarity is driven by BOM complexity, architecture, validation scope, certification, and volume.",
  },
  {
    id: "machining",
    label: "Machining Parts",
    letter: "M",
    iconBg: "#e8f8f3",
    iconFg: "#0d7a55",
    profileId: "machining_precision_v1",
    blurb:
      "CNC housings, manifolds, shafts, and precision machined components. Driven by material, process route, tolerance, cycle time, and secondary operations.",
  },
  {
    id: "stamping",
    label: "Stamping Parts",
    letter: "S",
    iconBg: "#fff4e0",
    iconFg: "#a05f0a",
    profileId: "stamping_bracket_v1",
    blurb:
      "Brackets, reinforcements, shields, and stamped metal parts. Driven by material grade, thickness, tooling type, operation count, tolerance, and volume.",
  },
  {
    id: "injection",
    label: "Injection Molded Parts",
    letter: "I",
    iconBg: "#f0ebfe",
    iconFg: "#6d28d9",
    profileId: "injection_molding_v1",
    blurb:
      "Interior trim, covers, housings, and molded plastics. Driven by resin, weight, cavitation, cosmetic class, tool complexity, and volume.",
  },
  {
    id: "assembly",
    label: "Assembly Modules",
    letter: "A",
    iconBg: "#e0f5f9",
    iconFg: "#0e7490",
    profileId: "assembly_module_v1",
    blurb:
      "Mechanical/electrical assemblies. Driven by component count, routing steps, labor, automation, EOL test scope, and volume.",
  },
  {
    id: "casting",
    label: "Casting / Forging",
    letter: "C",
    iconBg: "#f5f0ff",
    iconFg: "#7c3aed",
    profileId: "casting_forging_v1",
    blurb:
      "Cast housings, forged carriers, and near-net-shape parts with finish machining. Driven by alloy, weight, geometry, tolerance, secondary machining, and volume.",
  },
] as const;

export const KB_CLASS_COUNT = KB_CLASS_ORDER.length;

type ClassifiableRow = {
  process_family: string;
  part_name: string;
  program_name: string;
};

/**
 * Assign a historical row to exactly one canonical class using process tokens first,
 * then part/program keywords. Tuned for automotive / industrial RFQ language.
 */
export function classifyKbClass(row: ClassifiableRow): KbClassId {
  const proc = (row.process_family || "").toLowerCase().trim();
  const blob = `${row.part_name} ${row.program_name} ${row.process_family}`.toLowerCase();

  if (
    /\b(ecu|pcb|pcba|bms|bm[s]|gateway|telematics|harness|lidar|inverter|adas|adcu|battery\s+management|electronics\s+module|sensor\s+module)\b/i.test(
      blob,
    )
  ) {
    return "electronics";
  }
  if (/\b(electronics|pcb|pcba|ecu|emb|ee\s+module)\b/.test(proc)) return "electronics";

  if (/\b(injection|injection[-\s]?mold|molded|molding|mould|thermoplastic|resin|bezel|a-surface|cosmetic\s+class)\b/i.test(blob)) {
    return "injection";
  }
  if (/\b(inject|mold|mould|im\s|rim\s)/i.test(proc)) return "injection";

  if (/\b(cast(ing)?|forg(e|ing)|foundry|die\s*cast|sand\s*cast|investment\s*cast)\b/i.test(blob)) {
    return "casting";
  }
  if (/\b(cast|forg|foundry|forge)\b/.test(proc)) return "casting";

  if (/\b(assembly|subassembly|module\s+assembly|welded\s+assembly|final\s+assembly|kitting)\b/i.test(blob)) {
    return "assembly";
  }
  if (/\b(assembl|kitting)\b/.test(proc)) return "assembly";

  if (
    /\b(cnc|machin|milling|turning|lathe|grind(ing)?|billet|manifold|5-axis|3-axis|mill-turn)\b/i.test(blob)
  ) {
    return "machining";
  }
  if (/\b(machin|cnc|mill|turn|lathe|grind|bore)\b/.test(proc)) return "machining";

  if (/\b(stamp|stamping|progressive\s+die|transfer\s+die|blanking|drawn\s+shell|press\s+form)\b/i.test(blob)) {
    return "stamping";
  }
  if (/\b(stamp|blank|prog(?:ressive)?|transfer)\b/.test(proc)) return "stamping";

  if (/\b(bracket|reinforcement|mounting\s+bracket|impact\s+bracket|seat\s+bracket|shield|clip|washer)\b/i.test(blob)) {
    return "stamping";
  }

  return "stamping";
}

export type KbClassBucket<T extends ClassifiableRow = ClassifiableRow> = KbClassMeta & {
  projects: T[];
};

export function partitionRowsIntoKbClasses<T extends ClassifiableRow>(rows: T[]): KbClassBucket<T>[] {
  const byId = new Map<KbClassId, T[]>();
  for (const m of KB_CLASS_ORDER) {
    byId.set(m.id, []);
  }
  for (const row of rows) {
    const id = classifyKbClass(row);
    byId.get(id)!.push(row);
  }
  return KB_CLASS_ORDER.map((m) => ({
    ...m,
    projects: byId.get(m.id) ?? [],
  }));
}

export function kbMetaById(id: KbClassId): KbClassMeta {
  return KB_CLASS_ORDER.find((k) => k.id === id) ?? KB_CLASS_ORDER[0];
}
