import type { DocType } from "@/data/rfqTypes";

import { DOC_GAP_CONF_THRESHOLD } from "@/lib/rfq/reconcileGapsWithDocuments";

export type SupplyMatchKind = "exact" | "strong" | "partial" | "weak" | "wrong";

export type GapDemoSampleFile = {
  filename: string;
  href: string;
  resolvesRule: string;
  docSlot: string;
  expectedOnMatch: string;
  note: string;
};

/** Demo gap filler downloads (NorthBridge workbook). */
export const GAP_DEMO_SAMPLE_FILES: GapDemoSampleFile[] = [
  {
    filename: "Packaging_Spec.pdf",
    href: "/samples/gap-demo/Packaging_Spec.pdf",
    resolvesRule: "RULE_001",
    docSlot: "Packaging_Spec.pdf",
    expectedOnMatch: "94% — clears packaging gap",
    note: "Upload only on RULE_001 / Packaging_Spec.pdf row.",
  },
  {
    filename: "Packaging_Spec_DRAFT.pdf",
    href: "/samples/gap-demo/Packaging_Spec_DRAFT.pdf",
    resolvesRule: "RULE_001",
    docSlot: "Packaging_Spec.pdf",
    expectedOnMatch: "71% — partial; gap stays open",
    note: "Draft revision — upload again with final Packaging_Spec.pdf.",
  },
  {
    filename: "DV_PV_Test_Standard.pdf",
    href: "/samples/gap-demo/DV_PV_Test_Standard.pdf",
    resolvesRule: "RULE_002",
    docSlot: "DV_PV_Test_Standard.pdf",
    expectedOnMatch: "95% — clears DV/PV test gap",
    note: "Upload on RULE_002 row only.",
  },
  {
    filename: "DV_PV_Test_Standard_DRAFT.pdf",
    href: "/samples/gap-demo/DV_PV_Test_Standard_DRAFT.pdf",
    resolvesRule: "RULE_002",
    docSlot: "DV_PV_Test_Standard.pdf",
    expectedOnMatch: "73% — partial; gap stays open",
    note: "Draft test pack — replace with final DV_PV_Test_Standard.pdf.",
  },
  {
    filename: "NB-QA-118_Customer_Spec.pdf",
    href: "/samples/gap-demo/NB-QA-118_Customer_Spec.pdf",
    resolvesRule: "RULE_028",
    docSlot: "NB-QA-118_Customer_Spec.pdf",
    expectedOnMatch: "92% — clears NB-QA-118 reference gap",
    note: "Upload on RULE_028 row only.",
  },
  {
    filename: "Appearance_Sample_Approval_Gate.pdf",
    href: "/samples/gap-demo/Appearance_Sample_Approval_Gate.pdf",
    resolvesRule: "RULE_027",
    docSlot: "Appearance_Sample_Approval_Gate.pdf",
    expectedOnMatch: "91% — clears appearance gate",
    note: "Customer appearance sign-off schedule.",
  },
];

function basename(name: string): string {
  const n = name.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  return (i >= 0 ? n.slice(i + 1) : n).toLowerCase();
}

/** Slot-specific tokens expected in a valid upload filename. */
const SLOT_FILE_PATTERNS: Record<string, RegExp[]> = {
  "packaging_spec.pdf": [/packaging[_\s-]?spec/i],
  "dv_pv_test_standard.pdf": [/dv[_\s-]?pv|nb-qa-118|test[_\s-]?standard/i],
  "nb-qa-118_customer_spec.pdf": [/nb-qa-118|customer[_\s-]?spec|qa-118.*spec/i],
  "appearance_sample_approval_gate.pdf": [/appearance|sample[_\s-]?approval|ppap[_\s-]?gate/i],
  "packaging_spec_mqu.pdf": [/packaging[_\s-]?spec.*mqu|packaging_spec_mqu/i],
  "dv_pv_test_nb-qa-118.pdf": [/dv[_\s-]?pv|nb-qa-118|test.*118/i],
  "nb-mat-spec-mqu-ts-014.pdf": [/nb-mat-spec|ts-014|mat[_\s-]?spec.*mqu/i],
};

const DRAFT_PATTERN = /\bdraft\b|_draft|draft_|preliminary|for review only/i;

const COMM_GOOD_FILENAME = /consolidated_cost_template|mqu-8842.*revb|mqu-8842_revb/i;

function slotKey(slotName: string): string {
  return basename(slotName);
}

function fileMatchesSlotPatterns(slotName: string, suppliedFileLabel: string): boolean {
  const patterns = SLOT_FILE_PATTERNS[slotKey(slotName)];
  if (!patterns) return false;
  const file = basename(suppliedFileLabel);
  return patterns.some((re) => re.test(file));
}

function isWrongDocTypeForSlot(slotName: string, suppliedFileLabel: string, slotType: DocType): boolean {
  const file = basename(suppliedFileLabel);
  const slot = slotKey(slotName);

  if (slotType === "test" || slot.includes("dv_pv") || slot.includes("test")) {
    if (/packaging[_\s-]?spec|^packaging/i.test(file) && !/test|dv|pv|qa-118/i.test(file)) return true;
  }
  if (slotType === "pkg" || slot.includes("packaging")) {
    if (/dv[_\s-]?pv|test[_\s-]?standard|nb-qa-118/i.test(file) && !/packaging/i.test(file)) return true;
  }
  if (slotType === "qual" || slot.includes("appearance")) {
    if (/packaging|dv[_\s-]?pv|cost_template/i.test(file) && !/appearance|sample|approval/i.test(file)) {
      return true;
    }
  }
  return false;
}

/**
 * How well the uploaded filename matches the expected package document slot.
 */
export function classifySupplyMatch(
  slotName: string,
  suppliedFileLabel: string,
  slotType: DocType,
): SupplyMatchKind {
  const fileBase = basename(suppliedFileLabel);
  const slotBase = slotKey(slotName);

  if (isWrongDocTypeForSlot(slotName, suppliedFileLabel, slotType)) {
    return "wrong";
  }

  if (fileBase === slotBase) {
    return DRAFT_PATTERN.test(suppliedFileLabel) ? "partial" : "exact";
  }

  if (slotType === "comm") {
    if (COMM_GOOD_FILENAME.test(suppliedFileLabel)) return "exact";
    if (/commercial|cost.*template|workbook.*mqu/i.test(suppliedFileLabel)) return "partial";
    return "weak";
  }

  if (slotType === "tech" && slotBase.includes("nb-mat-spec")) {
    if (/rev.?a|ts-014_rev/i.test(suppliedFileLabel)) return "exact";
    if (/nb-mat-spec|ts-014/i.test(suppliedFileLabel)) return DRAFT_PATTERN.test(suppliedFileLabel) ? "partial" : "strong";
    return "weak";
  }

  if (fileMatchesSlotPatterns(slotName, suppliedFileLabel)) {
    return DRAFT_PATTERN.test(suppliedFileLabel) ? "partial" : "strong";
  }

  if (/\.pdf$|\.docx?$|\.xlsx?$/i.test(suppliedFileLabel)) {
    return "weak";
  }

  return "wrong";
}

const CONF_BY_MATCH: Record<SupplyMatchKind, Record<DocType | "default", number>> = {
  exact: {
    pkg: 0.94,
    test: 0.95,
    qual: 0.91,
    tech: 0.93,
    comm: 0.96,
    default: 0.92,
    rfq: 0.92,
    cost: 0.92,
    draw: 0.92,
    q: 0.9,
    nda: 0.9,
  },
  strong: {
    pkg: 0.89,
    test: 0.9,
    qual: 0.88,
    tech: 0.87,
    comm: 0.82,
    default: 0.88,
    rfq: 0.88,
    cost: 0.88,
    draw: 0.88,
    q: 0.86,
    nda: 0.86,
  },
  partial: {
    pkg: 0.71,
    test: 0.73,
    qual: 0.74,
    tech: 0.68,
    comm: 0.79,
    default: 0.72,
    rfq: 0.72,
    cost: 0.72,
    draw: 0.72,
    q: 0.7,
    nda: 0.7,
  },
  weak: {
    pkg: 0.58,
    test: 0.55,
    qual: 0.57,
    tech: 0.52,
    comm: 0.61,
    default: 0.56,
    rfq: 0.56,
    cost: 0.56,
    draw: 0.56,
    q: 0.54,
    nda: 0.54,
  },
  wrong: {
    pkg: 0.48,
    test: 0.46,
    qual: 0.47,
    tech: 0.45,
    comm: 0.5,
    default: 0.47,
    rfq: 0.47,
    cost: 0.47,
    draw: 0.47,
    q: 0.45,
    nda: 0.45,
  },
};

export function confidenceAfterSupplyMatch(
  match: SupplyMatchKind,
  slotType: DocType,
  currentConf: number | null,
): number {
  const table = CONF_BY_MATCH[match];
  const base = table[slotType] ?? table.default;
  if (match === "partial" && currentConf != null && currentConf > base) {
    return Math.min(DOC_GAP_CONF_THRESHOLD - 0.01, currentConf + 0.04);
  }
  return base;
}

export function supplyNoteForMatch(
  match: SupplyMatchKind,
  slotName: string,
  suppliedFileLabel: string,
): string {
  const pct = (kind: SupplyMatchKind) => {
    const c = CONF_BY_MATCH[kind].default;
    return `${Math.round(c * 100)}%`;
  };

  switch (match) {
    case "exact":
      return `Verified match for slot “${slotName}” — “${suppliedFileLabel}”.`;
    case "strong":
      return `Probable match for “${slotName}” — “${suppliedFileLabel}” (${pct("strong")} confidence).`;
    case "partial":
      return `Draft or incomplete file for “${slotName}” — “${suppliedFileLabel}” (${pct("partial")} confidence). Upload the final controlled document.`;
    case "weak":
      return `Weak filename match for “${slotName}” — “${suppliedFileLabel}”. Expected file like “${slotName}”.`;
    case "wrong":
      return `Wrong document type for slot “${slotName}” — “${suppliedFileLabel}” does not match this gap. Use the sample file for ${slotName}.`;
  }
}

export function evaluateDocumentSupply(
  slotName: string,
  suppliedFileLabel: string,
  slotType: DocType,
  currentConf: number | null,
): { match: SupplyMatchKind; conf: number; note: string } {
  const match = classifySupplyMatch(slotName, suppliedFileLabel, slotType);
  const conf = confidenceAfterSupplyMatch(match, slotType, currentConf);
  const note = supplyNoteForMatch(match, slotName, suppliedFileLabel);
  return { match, conf, note };
}
