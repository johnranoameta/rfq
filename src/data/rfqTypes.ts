export type DocType =
  | "rfq"
  | "cost"
  | "draw"
  | "pkg"
  | "test"
  | "q"
  | "tech"
  | "qual"
  | "comm"
  | "nda";
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

/** Workflow status for a gap row (Gap Analysis tab). */
export type GapWorkflowStatus = "open" | "in_review" | "resolved" | "accepted_risk";

export type GapFinding = {
  rule: string;
  sev: GapSeverity;
  cat: GapCategory;
  title: string;
  detail: string;
  impact: string;
  evidence: string;
  action: string;
  /** When set, this gap tracks the package row with this file name (Documents tab). */
  doc_slot?: string;
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
  id: string;
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
  /** Full gap template for bundled demos; visible gaps are derived from documents when this is set. */
  gap_catalog?: GapFinding[];
  /** Per-rule workflow on Gap Analysis (e.g. Resolved after upload or manual triage). */
  gap_workflow?: Partial<Record<string, GapWorkflowStatus>>;
  quote: Quote;
  historical_benchmark: HistoricalEntry[];
};
