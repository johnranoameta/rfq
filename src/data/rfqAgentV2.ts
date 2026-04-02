export type CaseId = "A" | "B" | "C";

export type DocType = "rfq" | "cost" | "draw" | "pkg" | "test" | "q";
export type DocStatus = "ok" | "miss" | "pend";

export type GapSeverity = "critical" | "high" | "medium" | "low";
export type GapCategory =
  | "completeness"
  | "quality"
  | "technical"
  | "commercial"
  | "logistics"
  | "quote";

export type HistoricalAward = "Won" | "Lost";

export type HistoricalEntry = {
  id: string;
  pn: string;
  name: string;
  material: string;
  vol: number;
  ppap: number;
  incoterm: string;
  terms: string;
  apd: number;
  price: number;
  tooling: number;
  pkg: number;
  award: HistoricalAward;
};

export type DocEntry = {
  name: string;
  type: DocType;
  status: DocStatus;
  conf: number | null;
  note: string;
};

export type GapFinding = {
  rule: string;
  sev: GapSeverity;
  cat: GapCategory;
  title: string;
  detail: string;
  impact: string;
  evidence: string;
  action: string;
  hist?: {
    projects: string[];
    label: string;
    hist_val: string;
    curr_val: string;
  };
};

export type QuoteLine = {
  pn: string;
  name: string;
  plant: string;
  vol: number;
  price: number;
  tooling: number;
  pkg: number;
  quality: number;
  freight: number;
  margin: number;
};

export type CostBreakdown = {
  material: number;
  labor: number;
  machine: number;
  overhead: number;
  scrap: number;
  quality: number;
  logistics: number;
  packaging: number;
  total: number;
};

export type Quote = {
  version: string;
  prepared_by: string;
  validity: number | null;
  total_value: number | null;
  total_tooling: number;
  risk_score: number;
  lines: QuoteLine[];
  cost_breakdown: CostBreakdown;
  hist_match: string[];
  hist_price_band: [number, number];
  hist_tooling_band: [number, number];
};

export type CaseData = {
  id: CaseId;
  rfq_num: string;
  title: string;
  customer: string;
  program: string;
  part_number: string;
  sop: string;
  annual_vol: number;
  material: string;
  thickness: number;
  tolerance: string;
  critical_tol: string;
  ppap: number;
  cpk: string;
  surface: string[];
  incoterm: string;
  payment: string;
  apd: number;
  currency: string;
  tooling_owner: string;
  process: string[];
  supplier_funded_gauges?: boolean;
  risk_score: number;
  completeness: "complete" | "incomplete" | "missing";
  status_label: string;
  docs: DocEntry[];
  triggered_rules: string[];
  gap_findings: GapFinding[];
  quote: Quote;
};

export const HISTORICAL: HistoricalEntry[] = [
  {
    id: "H015",
    pn: "NB-SI-2519",
    name: "Seat Side Impact Reinf.",
    material: "SPFC980Y",
    vol: 152000,
    ppap: 3,
    incoterm: "FOB Shanghai",
    terms: "Net 90",
    apd: 2.5,
    price: 6.08,
    tooling: 69000,
    pkg: 0.15,
    award: "Won",
  },
  {
    id: "H016",
    pn: "NB-SI-2586",
    name: "Seat Side Impact Reinf.",
    material: "SPFC980Y",
    vol: 148000,
    ppap: 3,
    incoterm: "FOB Shanghai",
    terms: "Net 90",
    apd: 2.5,
    price: 6.15,
    tooling: 70000,
    pkg: 0.15,
    award: "Won",
  },
  {
    id: "H017",
    pn: "NB-SI-2633",
    name: "Seat Side Impact Reinf.",
    material: "SPFC980Y",
    vol: 150000,
    ppap: 3,
    incoterm: "FOB Shanghai",
    terms: "Net 90",
    apd: 2.5,
    price: 6.22,
    tooling: 70500,
    pkg: 0.16,
    award: "Lost",
  },
  {
    id: "H001",
    pn: "NB-SS-1101",
    name: "Front Seat Reinf. Bracket",
    material: "SPCC",
    vol: 190000,
    ppap: 3,
    incoterm: "FOB Shanghai",
    terms: "Net 60",
    apd: 2.0,
    price: 4.05,
    tooling: 38000,
    pkg: 0.08,
    award: "Won",
  },
  {
    id: "H002",
    pn: "NB-SS-1178",
    name: "Front Seat Reinf. Bracket",
    material: "SPCC",
    vol: 175000,
    ppap: 3,
    incoterm: "FOB Shanghai",
    terms: "Net 60",
    apd: 2.0,
    price: 4.12,
    tooling: 39500,
    pkg: 0.07,
    award: "Won",
  },
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

export const CASES: Record<CaseId, CaseData> = {
  A: {
    id: "A",
    rfq_num: "RFQ-2025-0437",
    title: "Front Seat Reinforcement Bracket",
    customer: "NorthBridge Automotive",
    program: "NB-EV Crossover",
    part_number: "NB-SS-2147",
    sop: "2027-03-01",
    annual_vol: 180000,
    material: "SPCC",
    thickness: 1.2,
    tolerance: "±0.10 mm",
    critical_tol: "±0.05 mm burr height",
    ppap: 3,
    cpk: "≥ 1.67",
    surface: ["oil-free", "burr < 0.05 mm", "no red rust"],
    incoterm: "FOB Shanghai",
    payment: "Net 60",
    apd: 2.0,
    currency: "USD",
    tooling_owner: "Customer",
    process: ["progressive die stamping", "forming"],
    risk_score: 24,
    completeness: "complete",
    status_label: "Nominal",
    docs: [
      {
        name: "RFQ_Main_Document.pdf",
        type: "rfq",
        status: "ok",
        conf: 0.97,
        note: "Core header and commercial terms extracted",
      },
      {
        name: "Cost_Template.xlsx",
        type: "cost",
        status: "ok",
        conf: 0.93,
        note: "Pricing template parsed — packaging cost line is zero",
      },
      {
        name: "Part_Drawing.pdf",
        type: "draw",
        status: "ok",
        conf: 0.9,
        note: "Tolerance and surface finish extracted",
      },
      {
        name: "Packaging_Spec.pdf",
        type: "pkg",
        status: "ok",
        conf: 0.88,
        note: "Packaging type confirmed — tray pack",
      },
      {
        name: "Supplier_Questionnaire.xlsx",
        type: "q",
        status: "ok",
        conf: 0.95,
        note: "Capacity and lead time captured",
      },
    ],
    triggered_rules: ["RULE_015", "RULE_019"],
    gap_findings: [
      {
        rule: "RULE_015",
        sev: "medium",
        cat: "technical",
        title: "Burr requirement below family norm",
        detail:
          "The drawing requires burr height < 0.05 mm, which is tighter than the standard SPHC/SPCC family spec of < 0.08 mm. A secondary deburr or edge-finishing step may be required. Current quote does not include a deburr operation in the process route.",
        impact: "Secondary op cost ~$0.05–0.08/pc",
        evidence: "Drawing §2, surface notes",
        action:
          "Confirm deburr operation with process engineering. Add cost if secondary step is required.",
      },
      {
        rule: "RULE_019",
        sev: "high",
        cat: "quote",
        title: "Packaging cost line is zero in cost template",
        detail:
          "Packaging specification is present in this case, but the packaging cost line in Cost_Template.xlsx is currently $0.00. The packaging spec references a standard tray pack, which typically costs $0.06–0.10/pc for this volume and part size. This is a completable gap — the spec exists, the number just needs to be entered.",
        impact: "Cost omission ~$0.06–0.10/pc",
        evidence: "Cost_Template.xlsx — packaging_cost_per_pc = 0",
        action:
          "Enter packaging cost from spec into template before quote release. Rule RULE_019 will clear once the field is populated.",
      },
    ],
    quote: {
      version: "v1 Draft",
      prepared_by: "K. Whitmore",
      validity: 90,
      total_value: null,
      total_tooling: 38000,
      risk_score: 24,
      lines: [
        {
          pn: "NB-SS-2147",
          name: "Front Seat Reinf. Bracket",
          plant: "PLT-01",
          vol: 180000,
          price: 4.08,
          tooling: 38000,
          pkg: 0,
          quality: 0.12,
          freight: 0.05,
          margin: 16.2,
        },
      ],
      cost_breakdown: {
        material: 2.58,
        labor: 0.41,
        machine: 0.52,
        overhead: 0.32,
        scrap: 0.07,
        quality: 0.12,
        logistics: 0.05,
        packaging: 0,
        total: 4.07,
      },
      hist_match: ["H001", "H002"],
      hist_price_band: [4.05, 4.12],
      hist_tooling_band: [38000, 39500],
    },
  },
  B: {
    id: "B",
    rfq_num: "RFQ-2025-0438",
    title: "Rear Floor Mounting Bracket",
    customer: "NorthBridge Automotive",
    program: "NB-EV Crossover",
    part_number: "NB-RF-2388",
    sop: "2027-05-15",
    annual_vol: 220000,
    material: "SPHC",
    thickness: 1.6,
    tolerance: "±0.10 mm",
    critical_tol: "Deburr to spec",
    ppap: 3,
    cpk: "Not specified",
    surface: ["e-coat ready", "oil-free", "no visible edge burrs"],
    incoterm: "FOB Shanghai",
    payment: "Net 75",
    apd: 2.0,
    currency: "USD",
    tooling_owner: "Not specified",
    process: ["stamping", "restrike", "deburr"],
    risk_score: 62,
    completeness: "incomplete",
    status_label: "Incomplete",
    docs: [
      {
        name: "RFQ_Main_Document.pdf",
        type: "rfq",
        status: "ok",
        conf: 0.96,
        note: "Header and commercial terms extracted",
      },
      {
        name: "Cost_Template.xlsx",
        type: "cost",
        status: "ok",
        conf: 0.91,
        note: "Pricing template parsed",
      },
      {
        name: "Part_Drawing.pdf",
        type: "draw",
        status: "ok",
        conf: 0.89,
        note: "General tolerance extracted — no critical feature detail",
      },
      {
        name: "Packaging_Spec.pdf",
        type: "pkg",
        status: "miss",
        conf: null,
        note: "Referenced in RFQ §5 but not included in package",
      },
      {
        name: "DV_PV_Test_Standard.pdf",
        type: "test",
        status: "miss",
        conf: null,
        note: "Referenced as NB-QA-118 in quality section — not received",
      },
    ],
    triggered_rules: ["RULE_001", "RULE_002", "RULE_027", "RULE_028"],
    gap_findings: [
      {
        rule: "RULE_001",
        sev: "high",
        cat: "completeness",
        title: "Missing packaging specification",
        detail:
          "Packaging_Spec.pdf is listed in the RFQ attachment list (§5, Attachment B3) but was not included in the package received. Packaging cost in the template is $0.00. For a 220K/yr floor bracket program, packaging cost is typically $0.09–0.12/pc. This gap must be resolved before quote release.",
        impact: "Cost omission $0.09–0.12/pc",
        evidence: "RFQ §5: 'Attachment B3 — Packaging_Spec.pdf (missing on purpose)'",
        action:
          "Request packaging specification from buyer immediately. If not received before quote-ready date, apply provisional assumption of $0.10/pc and document in assumptions sheet.",
      },
      {
        rule: "RULE_002",
        sev: "high",
        cat: "completeness",
        title: "Test standard NB-QA-118 not received",
        detail:
          "The quality section (§3) references 'DV and PV test requirements per customer specification NB-QA-118' but this document was not included in the package. Without knowing the test scope, DV/PV validation cost cannot be estimated. For floor brackets in the EV Crossover program, validation typically adds $15,000–$35,000 NRE.",
        impact: "Unknown NRE — estimated $15K–35K",
        evidence: "RFQ §3: 'DV and PV test requirements per customer specification NB-QA-118'",
        action:
          "Request NB-QA-118 from buyer before finalizing quality cost. Escalate if not received within 5 business days. Do not submit quote without resolved test scope.",
      },
      {
        rule: "RULE_027",
        sev: "medium",
        cat: "quality",
        title: "Appearance approval required prior to PPAP",
        detail:
          "The quality section requires 'appearance sample approval required prior to PPAP.' This creates a two-stage approval milestone before SOP. Appearance sample timing is not currently reflected in the program plan assumptions and could add 4–8 weeks to the pre-PPAP timeline depending on customer review cycles.",
        impact: "Program timing risk — 4–8 weeks",
        evidence: "RFQ §3: 'Appearance sample approval required prior to PPAP'",
        action:
          "Add appearance sample milestone to program plan. Confirm customer review cycle time and include in SOP lead-time assumptions.",
      },
      {
        rule: "RULE_028",
        sev: "medium",
        cat: "completeness",
        title: "Customer spec reference NB-QA-118 unresolved",
        detail:
          "NB-QA-118 is referenced in the RFQ body for DV/PV test requirements but no file was received and the spec is not in the historical project database. This is a separate tracking item from RULE_002 — the spec reference itself must be acknowledged and tracked even if the file is eventually provided.",
        impact: "Compliance and tracking risk",
        evidence: "RFQ §3 quality requirement reference",
        action:
          "Create clarification tracker item. Log in RFQ review notes that this spec is referenced but not received, and assign an owner to follow up with the buyer contact.",
      },
    ],
    quote: {
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
    },
  },
  C: {
    id: "C",
    rfq_num: "RFQ-2025-0439",
    title: "Seat Side Impact Reinforcement",
    customer: "NorthBridge Automotive",
    program: "NB-EV Premium",
    part_number: "NB-SI-3411",
    sop: "2027-02-01",
    annual_vol: 150000,
    material: "SPFC980Y",
    thickness: 1.8,
    tolerance: "±0.03 mm (hole pitch)",
    critical_tol: "Flatness <= 0.15 mm",
    ppap: 5,
    cpk: "≥ 1.67 at SOP / ≥ 1.33 ongoing",
    surface: ["100% appearance inspection", "burr < 0.03 mm", "no edge crack"],
    incoterm: "DDP Monterrey",
    payment: "Net 120",
    apd: 4.0,
    currency: "USD",
    tooling_owner: "Supplier",
    process: ["progressive die stamping", "forming", "in-line camera inspection"],
    supplier_funded_gauges: true,
    risk_score: 89,
    completeness: "complete",
    status_label: "High Risk",
    docs: [
      {
        name: "RFQ_Main_Document.pdf",
        type: "rfq",
        status: "ok",
        conf: 0.98,
        note: "Full commercial and technical data extracted",
      },
      {
        name: "Cost_Template.xlsx",
        type: "cost",
        status: "ok",
        conf: 0.94,
        note: "Pricing template parsed — multiple cost gaps detected",
      },
      {
        name: "Part_Drawing.pdf",
        type: "draw",
        status: "ok",
        conf: 0.92,
        note: "Critical tolerances and SC/CC extracted",
      },
      {
        name: "Packaging_Spec.pdf",
        type: "pkg",
        status: "ok",
        conf: 0.87,
        note: "Returnable rack requirement confirmed",
      },
      {
        name: "Supplier_Questionnaire.xlsx",
        type: "q",
        status: "ok",
        conf: 0.93,
        note: "Capacity and gauge requirements captured",
      },
    ],
    triggered_rules: [
      "RULE_003",
      "RULE_004",
      "RULE_005",
      "RULE_007",
      "RULE_008",
      "RULE_009",
      "RULE_010",
      "RULE_011",
      "RULE_012",
      "RULE_013",
      "RULE_015",
      "RULE_016",
      "RULE_017",
      "RULE_018",
    ],
    gap_findings: [
      {
        rule: "RULE_003",
        sev: "high",
        cat: "quality",
        title: "PPAP Level 5 — above historical norm of Level 3",
        detail:
          "This RFQ requires PPAP Level 5 (full submission to customer) vs. the historical family baseline of Level 3. Level 5 adds full-time customer review requirements, additional documentation, and typically adds $8,000–$18,000 NRE in PPAP preparation labor and document management over Level 3.",
        impact: "NRE +$8K–18K vs historical",
        evidence: "RFQ §3: 'PPAP Level 5 required'",
        action:
          "Add explicit PPAP L5 NRE line item. Include run-at-rate machine allocation, full dimensional report, and customer sign-off timeline in program plan.",
        hist: {
          projects: ["H015", "H016", "H017"],
          label: "Historical PPAP Level",
          hist_val: "Level 3",
          curr_val: "Level 5",
        },
      },
      {
        rule: "RULE_004",
        sev: "high",
        cat: "technical",
        title: "Hole pitch tolerance ±0.03 mm — tighter than historical family",
        detail:
          "The critical hole position tolerance is ±0.03 mm. Historical SPFC980Y projects (H015–H017) were quoted at ±0.05 mm general tolerance. The tighter tolerance will require enhanced die build standards, additional tryout iterations, and likely 100% go/no-go gauge inspection on the critical feature.",
        impact: "Scrap +1.5–2× / extra die trials",
        evidence: "RFQ §2: 'Critical hole position tolerance +/-0.03 mm'",
        action:
          "Request feasibility review from manufacturing engineering. Increase scrap allowance and add tooling tryout contingency.",
        hist: {
          projects: ["H015", "H016", "H017"],
          label: "Historical Tolerance",
          hist_val: "±0.05 mm",
          curr_val: "±0.03 mm",
        },
      },
      {
        rule: "RULE_005",
        sev: "high",
        cat: "technical",
        title: "Critical tolerance at process capability limit",
        detail:
          "±0.03 mm is at or approaching the boundary of repeatable progressive die stamping capability for 1.8 mm SPFC980Y. If normal die wear shifts the process even slightly, 100% rejection of critical features is possible. This needs explicit feasibility sign-off — it is not a routine quoting assumption.",
        impact: "Capability risk — may require CNC secondary op",
        evidence: "Drawing critical feature callout",
        action:
          "Do not quote final price until manufacturing engineering confirms ±0.03 mm is achievable in-process. Consider adding a CNC secondary operation as a contingency.",
      },
      {
        rule: "RULE_007",
        sev: "high",
        cat: "quality",
        title:
          "Supplier-funded check gauges required with customer approval",
        detail:
          "The RFQ requires supplier-funded gauges for the critical hole pitch feature, and gauge design must receive customer approval before production. Gauge investment for this complexity typically runs $12,000–$22,000. This is separate from base tooling and must be quoted as a standalone line item.",
        impact: "Gauge NRE $12K–22K unquoted",
        evidence: "RFQ §2: 'Supplier-funded gauges require customer approval'",
        action:
          "Add separate gauge/check-fixture line item to tooling section. Clarify amortization treatment and whether customer approval timeline is included in SOP lead time.",
      },
      {
        rule: "RULE_008",
        sev: "high",
        cat: "quality",
        title: "100% appearance inspection required",
        detail:
          "100% appearance inspection (in addition to camera inspection) requires a dedicated inspection station or a significant portion of operator time. At 150K/yr, this represents ~820 units/day through inspection. Labor cost impact depends on takt time but is typically $0.10–0.18/pc for this part complexity.",
        impact: "Inspection labor $0.10–0.18/pc",
        evidence: "RFQ §2: '100 percent appearance inspection required'",
        action:
          "Add inspection station labor, floor space, and consumables to the cost model. Do not absorb within general overhead.",
      },
      {
        rule: "RULE_009",
        sev: "medium",
        cat: "commercial",
        title: "Net 120 payment terms exceed historical norm",
        detail:
          "Net 120 is significantly beyond the historical NorthBridge norm of Net 90 (H015–H017). At $6.20/pc estimated launch price and 150K units, the annual revenue is ~$930K. The additional 30-day extension beyond Net 90 adds ~$7,700/yr in financing cost at a 10% working capital rate.",
        impact: "~$7.7K/yr incremental financing",
        evidence: "RFQ §4: 'Payment Terms: Net 120'",
        action:
          "Escalate to Finance for approval. If accepted, add financing surcharge to unit price (~$0.05/pc) or negotiate to Net 90 matching the historical program baseline.",
        hist: {
          projects: ["H015", "H016", "H017"],
          label: "Historical Terms",
          hist_val: "Net 90",
          curr_val: "Net 120",
        },
      },
      {
        rule: "RULE_010",
        sev: "medium",
        cat: "commercial",
        title: "Annual price reduction 4% — above historical norm of 2.5%",
        detail:
          "The RFQ requires 4% annual cost reduction vs. the historical NorthBridge EV Premium family norm of 2.5%. Over a 5-year program from SOP 2027, this compounds to a 18.5% cumulative price reduction vs. 11.6% historically. At $6.20 launch price, the year-5 effective price would be ~$5.06 — a $1.14/pc erosion.",
        impact: "Year-5 margin erosion vs. historical",
        evidence: "RFQ §4: 'Annual Cost Reduction: 4 percent every year'",
        action:
          "Model full price curve in business case. Confirm floor margin is positive at year 5. Flag for management review — 4% APD is above the standard NorthBridge rate.",
        hist: {
          projects: ["H015", "H016", "H017"],
          label: "Historical APD",
          hist_val: "2.5%/yr",
          curr_val: "4.0%/yr",
        },
      },
      {
        rule: "RULE_011",
        sev: "high",
        cat: "commercial",
        title: "DDP Monterrey — freight and customs not in quote",
        detail:
          "DDP Monterrey requires the supplier to absorb all freight, customs, brokerage, and delivery costs to Monterrey, Mexico. Historical projects were all quoted FOB Shanghai. The freight delta for DDP vs. FOB is estimated at $0.28–0.42/pc for steel stampings of this weight at this volume, plus customs volatility risk.",
        impact: "Logistics gap ~$0.28–0.42/pc",
        evidence: "RFQ §4: 'Incoterm: DDP Monterrey'",
        action:
          "Rebuild logistics cost model for DDP. Engage freight forwarder for rate quote. Add customs duty and brokerage line. Do not use historical FOB logistics cost as the base.",
        hist: {
          projects: ["H015", "H016", "H017"],
          label: "Historical Incoterm",
          hist_val: "FOB Shanghai",
          curr_val: "DDP Monterrey",
        },
      },
      {
        rule: "RULE_012",
        sev: "medium",
        cat: "logistics",
        title: "Returnable rack required — not quoted",
        detail:
          "The packaging spec confirms 'Returnable rack required; one-way packaging is not accepted.' Returnable rack programs add rack acquisition cost, cycle count management, and a rack loss/damage allowance. For a steel bracket at this volume, rack investment is typically $18,000–$35,000 plus $0.04–0.07/pc ongoing cycle-loss allowance.",
        impact: "Rack investment $18K–35K + $0.04–0.07/pc",
        evidence: "RFQ §5: 'Returnable rack required'",
        action:
          "Add returnable rack line to tooling/NRE and include per-piece cycle-loss allowance in the cost model.",
      },
      {
        rule: "RULE_013",
        sev: "medium",
        cat: "commercial",
        title: "Premium freight recovery excluded after nomination",
        detail:
          "The RFQ explicitly states 'Premium freight recovery not allowed after nomination.' This removes the standard safety valve for expediting costs during launch and ramp-up. If premium freight is required, the cost is fully absorbed by the supplier.",
        impact: "Launch freight risk unquoted",
        evidence:
          "RFQ §5: 'Premium freight recovery not allowed after nomination'",
        action:
          "Add a launch freight buffer to NRE (recommend $8,000–$15,000 contingency) and document the contractual restriction in the quote assumptions sheet.",
      },
      {
        rule: "RULE_015",
        sev: "medium",
        cat: "technical",
        title: "Burr spec below family norm — edge crack prohibition",
        detail:
          "Burr height < 0.03 mm and 'edge crack not allowed' are stricter than the historical family (< 0.05 mm, no edge crack specification). This likely requires an inline deburr or finishing step not present in historical process routes.",
        impact: "Secondary op cost ~$0.05–0.10/pc",
        evidence: "RFQ §2 surface requirements",
        action:
          "Confirm deburr/edge finishing operation with process engineering and add to cost model.",
      },
      {
        rule: "RULE_016",
        sev: "medium",
        cat: "quality",
        title: "Cpk ≥ 1.67 at SOP — above typical family baseline",
        detail:
          "Cpk ≥ 1.67 at SOP is a tighter launch target than the historical EV Premium family baseline of Cpk ≥ 1.33. Achieving this requires extended process qualification during tryout, additional measurement runs, and potentially adjusted process parameters before first PPAP submission.",
        impact: "Extended qualification timeline",
        evidence: "RFQ §3: 'Cpk >= 1.67 at SOP and >= 1.33 ongoing'",
        action:
          "Assess additional statistical process control effort and add to PPAP preparation budget.",
      },
      {
        rule: "RULE_017",
        sev: "medium",
        cat: "quality",
        title: "Run-at-rate required beyond standard PPAP",
        detail:
          "A run-at-rate event is required as part of PPAP, which is above the standard PPAP Level 3 expectation. Run-at-rate requires dedicating a production shift to the customer's observation, which has a direct machine-time and labor opportunity cost typically valued at $4,000–$8,000 per event.",
        impact: "Run-at-rate cost $4K–8K",
        evidence: "RFQ §3: 'Run at rate and full dimensional report required'",
        action:
          "Add run-at-rate cost to PPAP NRE line. Coordinate machine availability with production planning during launch phase.",
      },
      {
        rule: "RULE_018",
        sev: "low",
        cat: "quality",
        title: "Annual revalidation and corrosion retention required",
        detail:
          "Annual revalidation tests and corrosion retention samples are required ongoing. This recurring cost is typically not quoted in the unit price but should be included in the long-term program cost model. Estimated at $3,000–$6,000 per year.",
        impact: "~$3K–6K/yr recurring quality cost",
        evidence: "RFQ §3: 'Annual revalidation and corrosion test retention required'",
        action:
          "Add recurring annual quality cost to the program financial model. Include in year-2+ margin calculations.",
      },
    ],
    quote: {
      version: "v1 Draft — High Risk",
      prepared_by: "K. Whitmore",
      validity: null,
      total_value: null,
      total_tooling: 70000,
      risk_score: 89,
      lines: [
        {
          pn: "NB-SI-3411",
          name: "Seat Side Impact Reinforcement",
          plant: "PLT-03",
          vol: 150000,
          price: 6.18,
          tooling: 70000,
          pkg: 0,
          quality: 0.12,
          freight: 0.05,
          margin: 13.4,
        },
      ],
      cost_breakdown: {
        material: 3.86,
        labor: 0.72,
        machine: 0.88,
        overhead: 0.56,
        scrap: 0.12,
        quality: 0.12,
        logistics: 0.05,
        packaging: 0,
        total: 6.31,
      },
      hist_match: ["H015", "H016", "H017"],
      hist_price_band: [6.08, 6.22],
      hist_tooling_band: [69000, 70500],
    },
  },
};

