import type { UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import type {
  CaseData,
  DocEntry,
  DocType,
  GapFinding,
  HistoricalEntry,
  ItemHistoricalComparison,
  Quote,
} from "@/data/rfqTypes";
import { reconcileCaseGapsWithDocuments } from "@/lib/rfq/reconcileGapsWithDocuments";

/** Primary demo file name (text) for copy and preloaded session. */
export const SAMPLE_RFQ_FILENAME = "Sample_RFQ_NorthBridge.txt";

export const SAMPLE_RFQ_PDF_FILENAME = "Sample_RFQ_NorthBridge.pdf";

export const SAMPLE_MULTI_ITEM_PDF_FILENAME = "Sample_Multi_Item_RFQ.pdf";

const BUNDLED_SAMPLE_NAMES = new Set([
  SAMPLE_RFQ_FILENAME,
  SAMPLE_RFQ_PDF_FILENAME,
  SAMPLE_MULTI_ITEM_PDF_FILENAME,
]);

/** Same demo pipeline runs when uploading the bundled .txt or .pdf sample. */
export function isBundledSampleRfq(name: string): boolean {
  return BUNDLED_SAMPLE_NAMES.has(name.trim());
}

export function isMultiItemBundledSample(name: string): boolean {
  return name.trim() === SAMPLE_MULTI_ITEM_PDF_FILENAME;
}

/** Shown on first load so the dashboard is usable without uploading first. */
export const DEFAULT_DEMO_UPLOAD: UploadedPackageFile = {
  id: "00000000-0000-4000-8000-000000000001",
  originalName: SAMPLE_RFQ_FILENAME,
  size: 0,
  mimeType: "text/plain",
  storedName: "preloaded-demo.txt",
};

export function isPreloadedDemoUpload(file: UploadedPackageFile): boolean {
  return file.storedName === DEFAULT_DEMO_UPLOAD.storedName;
}

export function getDefaultDemoSession(): {
  file: UploadedPackageFile;
  caseData: CaseData;
} {
  return {
    file: DEFAULT_DEMO_UPLOAD,
    caseData: buildCaseDataFromDemoPipeline(DEFAULT_DEMO_UPLOAD),
  };
}

/** Simulated `/parse` response (Case B — incomplete package). */
export const DEMO_PARSE_OUTPUT = {
  rfq_case: "B",
  document_completeness: "incomplete",
  customer: "NorthBridge Automotive",
  program: "NB-EV Crossover",
  part_name: "Rear Floor Mounting Bracket",
  part_number: "NB-RF-2388",
  process_family: ["stamping", "restrike", "deburr"],
  material_grade: "SPHC",
  thickness_mm: 1.6,
  annual_volume: 220000,
  sop_date: "2027-05-15",
  general_tolerance_mm: 0.1,
  ppap_level: 3,
  incoterm: "FOB Shanghai",
  payment_terms: "Net 75",
  annual_reduction_pct: 2.0,
  required_attachments: [
    { file_name: "Cost_Template.xlsx", type: "cost_template", included: true },
    { file_name: "Part_Drawing.pdf", type: "drawing", included: true },
    { file_name: "Packaging_Spec.pdf", type: "packaging_spec", included: false },
    { file_name: "DV_PV_Test_Standard.pdf", type: "test_standard", included: false },
  ],
  missing_references: ["Packaging_Spec.pdf", "DV_PV_Test_Standard.pdf"],
} as const;

/** Simulated `/parse` for `Sample_Multi_Item_RFQ.pdf` — full doc-type coverage + one fuzzy commercial match. */
export const DEMO_MULTI_ITEM_PARSE_OUTPUT = {
  rfq_case: "B_multi",
  document_completeness: "incomplete",
  customer: "NorthBridge Automotive",
  program: "NB-EV Crossover",
  part_name: "Rear floor bracket assy LH",
  part_number: "NB-RF-3100",
  process_family: ["stamping", "deburr"],
  material_grade: "SPHC",
  thickness_mm: 1.6,
  annual_volume: 185000,
  sop_date: "2027-08-01",
  general_tolerance_mm: 0.1,
  ppap_level: 3,
  incoterm: "FOB Shanghai",
  payment_terms: "Net 75",
  annual_reduction_pct: 2.0,
  required_attachments: [
    { file_name: "Sample_Multi_Item_RFQ.pdf", type: "rfq_main", included: true },
    { file_name: "NB-RF-3100_drawing_RevB.pdf", type: "drawing", included: true },
    { file_name: "NB-MAT-SPEC-MQU-TS-014.pdf", type: "tech_spec", included: true },
    { file_name: "NorthBridge_CSR_IATF_2026_Supplier_Manual.pdf", type: "quality_csr", included: true },
    {
      file_name: "RFQ-Commercial_Workbook_MQU_v3.xlsx",
      type: "commercial_terms",
      included: true,
      expected_file_name: "Consolidated_Cost_Template_MQU-8842_RevB.xlsx",
      match_confidence: 0.79,
    },
    { file_name: "Supplier_NDA_2025.pdf", type: "nda", included: true },
    { file_name: "Packaging_Spec_MQU.pdf", type: "packaging_spec", included: false },
    { file_name: "DV_PV_Test_NB-QA-118.pdf", type: "test_standard", included: false, pending: true },
  ],
  missing_references: ["Packaging_Spec_MQU.pdf"],
  pending_references: ["DV_PV_Test_NB-QA-118.pdf"],
} as const;

/** Simulated `/gap-review` response. */
export const DEMO_GAP_OUTPUT = {
  case_id: "case_B",
  risk_score: 62,
  completeness_status: "fail",
  missing_attachments: ["Packaging_Spec.pdf", "DV_PV_Test_Standard.pdf"],
  triggered_rules: ["RULE_001", "RULE_002", "RULE_027", "RULE_028"],
  summary:
    "Incomplete RFQ package. Packaging and DV/PV standard are referenced but not included. Quote should not be released without clarification or documented assumptions.",
  recommended_actions: [
    "Request missing packaging specification from customer or add provisional packaging assumption with approval.",
    "Request DV/PV test standard NB-QA-118 before quality cost is finalized.",
    "Add appearance approval timing risk to RFQ review notes.",
  ],
} as const;

export const DEMO_MULTI_ITEM_GAP_OUTPUT = {
  case_id: "case_B_multi",
  risk_score: 58,
  completeness_status: "fail",
  missing_attachments: ["Packaging_Spec_MQU.pdf"],
  triggered_rules: ["RULE_001", "RULE_002", "RULE_029", "RULE_028", "RULE_UX_TECH_MQU", "RULE_UX_COMM_GATE"],
  summary:
    "Multi-line RFQ package: packaging specification not received; DV/PV test plan requested under separate cover. " +
    "Commercial workbook attached under an interim filename — verify against Consolidated_Cost_Template_MQU-8842_RevB.xlsx before award.",
  recommended_actions: [
    "Request Packaging_Spec_MQU.pdf or document packaging assumptions with buyer sign-off.",
    "Follow up on DV_PV_Test_NB-QA-118.pdf before locking validation cost.",
    "Replace or formally accept RFQ-Commercial_Workbook_MQU_v3.xlsx vs. required Consolidated_Cost_Template_MQU-8842_RevB.xlsx.",
    "Complete technical baseline review (tolerances, mat spec, SOP stack-up) per TECHNICAL REQUIREMENTS section.",
    "Run commercial gate checklist (incoterms, payment, tooling amortization, quote validity) per COMMERCIAL TERMS section.",
  ],
} as const;

function demoHistoricalMatch(
  projectId: string,
  partNumber: string,
  partName: string,
  score: number,
  exactPn: boolean,
  reasons: string[],
  quotedPrice: number,
): ItemHistoricalComparison["matches"][number] {
  return {
    project_id: projectId,
    score,
    similarity_0_1: score / 100,
    exact_part_number: exactPn,
    reasons,
    record: {
      rfq: {
        part_name: partName,
        part_number: partNumber,
        material: "SPHC",
        process: "stamping",
      },
      quote_result: {
        quoted_piece_price_usd: quotedPrice,
      },
    },
  };
}

/** Per-line historical reference rows (same shape as workbook `rankHistoricalMatches` output). */
const DEMO_ITEM_HISTORICAL_COMPARISON: ItemHistoricalComparison[] = [
  {
    item_index: 0,
    item_label: "Line 1 — NB-RF-2388",
    part_name: "Rear Floor Mounting Bracket",
    matches: [
      demoHistoricalMatch("H003", "NB-RF-1204", "Rear Floor Mounting Bracket", 91, false, [
        "material match",
        "program match",
        "process match",
        "customer overlap",
        "high part-name similarity",
        "similar annual volume",
        "thickness close",
      ], 4.42),
      demoHistoricalMatch("H004", "NB-RF-1229", "Rear Floor Mounting Bracket", 88, false, [
        "material match",
        "program match",
        "process match",
        "customer overlap",
        "high part-name similarity",
        "related volume band",
        "thickness close",
      ], 4.35),
      demoHistoricalMatch("H005", "NB-SI-2071", "Seat Side Reinforcement", 64, false, [
        "material match",
        "process match",
        "customer overlap",
        "moderate part-name similarity",
      ], 5.12),
    ],
  },
];

const DEMO_MULTI_ITEM_HISTORICAL_COMPARISON: ItemHistoricalComparison[] = [
  ...DEMO_ITEM_HISTORICAL_COMPARISON,
  {
    item_index: 1,
    item_label: "Line 2 — NB-RF-3101",
    part_name: "Rear floor bracket assy RH",
    matches: [
      demoHistoricalMatch("H003", "NB-RF-1204", "Rear Floor Mounting Bracket", 78, false, [
        "material match",
        "process match",
        "customer overlap",
        "moderate part-name similarity",
        "related volume band",
      ], 4.42),
      demoHistoricalMatch("H011", "NB-TR-1011", "Tunnel Reinforcement Bracket", 61, false, [
        "process match",
        "customer overlap",
        "partial spec similarity",
      ], 3.98),
    ],
  },
];

const DEMO_HISTORICAL: HistoricalEntry[] = [
  {
    id: "H003",
    pn: "NB-RF-1204",
    name: "Rear Floor Mounting Bracket",
    material: "SPHC",
    vol: 210000,
    ppap: 3,
    incoterm: "FOB Shanghai",
    terms: "Net 75",
    apd: 2.0,
    price: 4.42,
    tooling: 42000,
    pkg: 0.1,
    award: "Won",
  },
  {
    id: "H004",
    pn: "NB-RF-1229",
    name: "Rear Floor Mounting Bracket",
    material: "SPHC",
    vol: 240000,
    ppap: 3,
    incoterm: "FOB Shanghai",
    terms: "Net 75",
    apd: 2.0,
    price: 4.35,
    tooling: 41000,
    pkg: 0.09,
    award: "Lost",
  },
];

const DEMO_GAP_FINDINGS: GapFinding[] = [
  {
    rule: "RULE_001",
    sev: "high",
    cat: "completeness",
    title: "Missing packaging specification",
    detail:
      "Packaging_Spec.pdf is listed in the RFQ attachment list (section 5) but was not included in the package received. Packaging cost in the template is $0.00. For a 220K/yr floor bracket program, packaging cost is typically $0.09–0.12/pc. This gap must be resolved before quote release.",
    impact: "Cost omission $0.09–0.12/pc",
    evidence: "RFQ section 5: Attachment B3 — Packaging_Spec.pdf referenced but not received",
    action:
      "Request packaging specification from buyer immediately. If not received before quote-ready date, apply provisional assumption of $0.10/pc and document in assumptions sheet.",
    doc_slot: "Packaging_Spec.pdf",
  },
  {
    rule: "RULE_002",
    sev: "high",
    cat: "completeness",
    title: "DV/PV test document not received",
    detail:
      "DV_PV_Test_Standard.pdf (customer test pack / NB-QA-118 scope) was not included in the package. Without the file, DV/PV validation cost cannot be estimated.",
    impact: "Unknown NRE — estimated $15K–35K",
    evidence: "RFQ quality section: DV/PV per NB-QA-118; package row DV_PV_Test_Standard.pdf missing",
    action:
      "Request DV_PV_Test_Standard.pdf / NB-QA-118 from buyer before finalizing quality cost. Do not submit quote without resolved test scope.",
    doc_slot: "DV_PV_Test_Standard.pdf",
  },
  {
    rule: "RULE_027",
    sev: "medium",
    cat: "quality",
    title: "Appearance approval required prior to PPAP",
    detail:
      "The quality section requires appearance sample approval prior to PPAP. This milestone is not reflected in program plan assumptions and could add 4–8 weeks pre-PPAP. Supply a customer appearance sign-off or schedule when available.",
    impact: "Program timing risk — 4–8 weeks",
    evidence: "RFQ quality section: appearance sample approval prior to PPAP",
    action:
      "Add appearance sample milestone to program plan. Confirm customer review cycle time for SOP lead-time assumptions.",
    doc_slot: "Appearance_Sample_Approval_Gate.pdf",
  },
  {
    rule: "RULE_028",
    sev: "medium",
    cat: "completeness",
    title: "Customer spec reference NB-QA-118 unresolved",
    detail:
      "NB-QA-118 is referenced for DV/PV requirements; the customer spec acknowledgment file is not yet in the package. Track as a formal clarification item.",
    impact: "Compliance and tracking risk",
    evidence: "RFQ body quality requirement reference; NB-QA-118_Customer_Spec.pdf missing",
    action:
      "Create clarification tracker item and assign an owner to follow up with the buyer contact.",
    doc_slot: "NB-QA-118_Customer_Spec.pdf",
  },
];

const DEMO_MULTI_ITEM_GAP_FINDINGS: GapFinding[] = [
  {
    rule: "RULE_001",
    sev: "high",
    cat: "completeness",
    title: "Missing packaging specification",
    detail:
      "Packaging_Spec_MQU.pdf is listed in the attachment checklist but was not included. Returnable packaging is required per logistics notes.",
    impact: "Packaging cost and line-side handling assumptions incomplete",
    evidence: "RFQ checklist: Packaging_Spec_MQU.pdf — not attached",
    action: "Request packaging specification from buyer or file documented assumptions.",
    doc_slot: "Packaging_Spec_MQU.pdf",
  },
  {
    rule: "RULE_002",
    sev: "high",
    cat: "completeness",
    title: "DV/PV test specification pending",
    detail:
      "DV_PV_Test_NB-QA-118.pdf is referenced for validation scope but marked as to follow under separate cover. DV/PV effort cannot be fully costed.",
    impact: "Unknown validation NRE band",
    evidence: "RFQ checklist: DV/PV test doc requested / not yet received",
    action: "Request test specification before final quote submission.",
    doc_slot: "DV_PV_Test_NB-QA-118.pdf",
  },
  {
    rule: "RULE_029",
    sev: "medium",
    cat: "commercial",
    title: "Commercial return template does not match controlled file name",
    detail:
      "Buyer requires Consolidated_Cost_Template_MQU-8842_RevB.xlsx for quote binding. Package contains RFQ-Commercial_Workbook_MQU_v3.xlsx — parsed as probable match with reduced confidence.",
    impact: "Commercial terms may need re-submission on official template",
    evidence: "RFQ section: required template name vs. uploaded workbook filename",
    action: "Confirm with buyer whether interim workbook is acceptable or re-file on Rev B template.",
    doc_slot: "RFQ-Commercial_Workbook_MQU_v3.xlsx",
  },
  {
    rule: "RULE_028",
    sev: "medium",
    cat: "completeness",
    title: "NB-QA-118 test reference unresolved until DV/PV file arrives",
    detail: "Test scope is defined by NB-QA-118; document not yet in package.",
    impact: "Compliance tracking risk",
    evidence: "RFQ body + checklist reference NB-QA-118",
    action: "Track as formal clarification until customer spec file is received.",
    doc_slot: "NB-QA-118_Customer_Spec.pdf",
  },
  {
    rule: "RULE_UX_TECH_MQU",
    sev: "medium",
    cat: "technical",
    title: "Technical baseline — line stack-up vs. controlled specs",
    detail:
      "Cross-check line-item tolerances, material callouts (incl. NB-MAT-SPEC-MQU-TS-014), SOP timing, and DV/PV hooks against the TECHNICAL REQUIREMENTS block in the master RFQ before engineering sign-off.",
    impact: "Scrap, rework, or PPAP timing risk if CTQs drift from RFQ",
    evidence: "RFQ sections: Line schedule + TECHNICAL REQUIREMENTS (Category: Technical)",
    action:
      "Engineering review: drawing Rev, heat treat / finish stack-up, inspection sampling vs. buyer CTQs; document assumptions.",
    doc_slot: "NB-MAT-SPEC-MQU-TS-014.pdf",
  },
  {
    rule: "RULE_UX_COMM_GATE",
    sev: "medium",
    cat: "commercial",
    title: "Commercial gate — terms match RFQ cover and template path",
    detail:
      "Confirm incoterms, payment terms, annual price-down, tooling amortization, and quote validity against the COMMERCIAL TERMS section and buyer standard PO language before binding submission.",
    impact: "Margin or cash-flow exposure if award terms differ from quote assumptions",
    evidence: "RFQ sections: COMMERCIAL TERMS (Category: Commercial) + controlled cost template rule",
    action: "Commercial sign-off on checklist; align with Consolidated_Cost_Template_MQU-8842_RevB.xlsx at award.",
  },
];

const APPEARANCE_DEMO_DOC: DocEntry = {
  name: "Appearance_Sample_Approval_Gate.pdf",
  type: "qual",
  status: "pend",
  conf: null,
  note: "RFQ requires appearance sample approval prior to PPAP — awaiting customer schedule or sign-off (demo).",
};

const NB_QA118_DEMO_DOC: DocEntry = {
  name: "NB-QA-118_Customer_Spec.pdf",
  type: "test",
  status: "miss",
  conf: null,
  note: "Customer spec NB-QA-118 referenced in RFQ; compliance acknowledgment not in package (demo).",
};

const DEMO_QUOTE: Quote = {
  version: "v1 Draft — Blocked",
  prepared_by: "K. Whitmore",
  validity: null,
  total_value: null,
  total_tooling: 42000,
  risk_score: 62,
  lines: [
    {
      pn: "NB-RF-2388",
      name: "Rear Floor Mounting Bracket",
      plant: "PLT-02",
      vol: 220000,
      price: 4.38,
      tooling: 42000,
      pkg: 0,
      quality: 0.12,
      freight: 0.05,
      margin: 14.6,
    },
  ],
  cost_breakdown: {
    material: 2.82,
    labor: 0.46,
    machine: 0.58,
    overhead: 0.36,
    scrap: 0.08,
    quality: 0.12,
    logistics: 0.05,
    packaging: 0,
    total: 4.47,
  },
  hist_match: ["H003", "H004"],
  hist_price_band: [4.35, 4.47],
  hist_tooling_band: [41000, 42500],
};

const DEMO_MULTI_ITEM_QUOTE: Quote = {
  ...DEMO_QUOTE,
  lines: [
    {
      pn: "NB-RF-3100",
      name: "Rear floor bracket assy LH",
      plant: "PLT-02",
      vol: 185000,
      price: 4.38,
      tooling: 42000,
      pkg: 0,
      quality: 0.12,
      freight: 0.05,
      margin: 14.6,
    },
  ],
  risk_score: DEMO_MULTI_ITEM_GAP_OUTPUT.risk_score,
};

function attachmentTypeToDocType(t: string): DocType {
  switch (t) {
    case "cost_template":
      return "cost";
    case "drawing":
      return "draw";
    case "packaging_spec":
      return "pkg";
    case "test_standard":
      return "test";
    case "supplier_questionnaire":
      return "q";
    case "tech_spec":
      return "tech";
    case "quality_csr":
      return "qual";
    case "commercial_terms":
      return "comm";
    case "nda":
      return "nda";
    case "rfq_main":
      return "rfq";
    default:
      return "rfq";
  }
}

function buildMultiItemDemoDocs(): DocEntry[] {
  return [
    {
      name: "Sample_Multi_Item_RFQ.pdf",
      type: "rfq",
      status: "ok",
      conf: 0.96,
      note: "Multi-line schedule + attachment checklist parsed (demo)",
    },
    {
      name: "NB-RF-3100_drawing_RevB.pdf",
      type: "draw",
      status: "ok",
      conf: 0.93,
      note: "Drawing Rev B linked to line 1 (demo)",
    },
    {
      name: "NB-MAT-SPEC-MQU-TS-014.pdf",
      type: "tech",
      status: "ok",
      conf: 0.4,
      note: "Draft / partial technical extract — low confidence. Upload NB-MAT-SPEC-MQU-TS-014_RevA.pdf.",
    },
    {
      name: "NorthBridge_CSR_IATF_2026_Supplier_Manual.pdf",
      type: "qual",
      status: "ok",
      conf: 0.97,
      note: "CSR / quality manual (demo)",
    },
    {
      name: "RFQ-Commercial_Workbook_MQU_v3.xlsx",
      type: "comm",
      status: "ok",
      conf: 0.79,
      note:
        "Checklist requires Consolidated_Cost_Template_MQU-8842_RevB.xlsx; uploaded workbook name/revision differ — heuristic match only (demo).",
    },
    {
      name: "Supplier_NDA_2025.pdf",
      type: "nda",
      status: "ok",
      conf: 0.95,
      note: "Supplier NDA in force for program (demo)",
    },
    {
      name: "Packaging_Spec_MQU.pdf",
      type: "pkg",
      status: "miss",
      conf: null,
      note: "Referenced in checklist; not in upload (demo)",
    },
    {
      name: "DV_PV_Test_NB-QA-118.pdf",
      type: "test",
      status: "pend",
      conf: null,
      note: "Requested / to follow under separate cover (demo)",
    },
    {
      name: "NB-QA-118_Customer_Spec.pdf",
      type: "test",
      status: "miss",
      conf: null,
      note: "Customer spec NB-QA-118 compliance file not in package (demo)",
    },
  ];
}

function buildDocsFromParse(): DocEntry[] {
  const main: DocEntry = {
    name: "RFQ_Main_Document.pdf",
    type: "rfq",
    status: "ok",
    conf: 0.96,
    note: "Parsed from uploaded RFQ narrative (demo)",
  };

  const rest: DocEntry[] = DEMO_PARSE_OUTPUT.required_attachments.map((a) => ({
    name: a.file_name,
    type: attachmentTypeToDocType(a.type),
    status: a.included ? ("ok" as const) : ("miss" as const),
    conf: a.included ? 0.9 : null,
    note: a.included
      ? "Included in package (demo)"
      : "Referenced in RFQ but not included in upload (demo)",
  }));

  return [main, ...rest];
}

export function buildCaseDataFromDemoPipeline(file: UploadedPackageFile): CaseData {
  const multi = isMultiItemBundledSample(file.originalName);
  const p = multi ? DEMO_MULTI_ITEM_PARSE_OUTPUT : DEMO_PARSE_OUTPUT;
  const g = multi ? DEMO_MULTI_ITEM_GAP_OUTPUT : DEMO_GAP_OUTPUT;

  const dc = p.document_completeness as "complete" | "incomplete" | "missing";
  const completeness =
    dc === "complete" ? "complete" : dc === "incomplete" ? "incomplete" : "missing";

  const status_label =
    g.completeness_status === "fail" ? "Incomplete" : g.completeness_status === "pass" ? "Ready" : "Review";

  const docs = multi
    ? buildMultiItemDemoDocs()
    : [...buildDocsFromParse(), APPEARANCE_DEMO_DOC, NB_QA118_DEMO_DOC];
  const docs_baseline = docs.map((d) => ({ ...d }));
  const gap_catalog = multi ? DEMO_MULTI_ITEM_GAP_FINDINGS : DEMO_GAP_FINDINGS;

  const partial: CaseData = {
    id: "session",
    rfq_num: `RFQ-UPLOAD-${file.id.slice(0, 8)}`,
    title: p.part_name,
    customer: p.customer,
    program: p.program,
    part_number: p.part_number,
    sop: p.sop_date,
    annual_vol: p.annual_volume,
    material: p.material_grade,
    thickness: p.thickness_mm,
    tolerance: `±${p.general_tolerance_mm} mm`,
    critical_tol: "Deburr to spec",
    ppap: p.ppap_level,
    cpk: "Not specified",
    surface: ["e-coat ready", "oil-free", "no visible edge burrs"],
    incoterm: p.incoterm,
    payment: p.payment_terms,
    apd: p.annual_reduction_pct,
    currency: "USD",
    tooling_owner: "Not specified",
    process: [...p.process_family],
    risk_score: g.risk_score,
    completeness,
    status_label,
    docs,
    docs_baseline,
    gap_catalog,
    triggered_rules: [...g.triggered_rules],
    gap_findings: [],
    gap_workflow: {},
    quote: multi
      ? { ...DEMO_MULTI_ITEM_QUOTE, risk_score: g.risk_score }
      : { ...DEMO_QUOTE, risk_score: g.risk_score },
    historical_benchmark: DEMO_HISTORICAL,
    item_historical_comparison: multi
      ? DEMO_MULTI_ITEM_HISTORICAL_COMPARISON
      : DEMO_ITEM_HISTORICAL_COMPARISON,
    kb_category_label: "Stamping & brackets",
    kb_category_slug: "stamping",
  };

  const reconciled = reconcileCaseGapsWithDocuments(partial);
  return reconciled;
}
