export type HistoricalRfqQuoteResult = {
  packaging_cost_per_pc: number;
  quoted_piece_price_usd: number;
  tooling_cost_usd: number;
  award_result: string;
};

export type HistoricalRfqCore = {
  customer: string;
  program: string;
  part_name: string;
  part_number: string;
  process: string;
  material: string;
  thickness_mm: number;
  annual_volume: number;
  general_tolerance_mm: number;
  ppap_level: number;
  incoterm: string;
  payment_terms: string;
  annual_reduction_pct: number;
};

export type HistoricalProjectRecord = {
  project_id: string;
  rfq: HistoricalRfqCore;
  quote_result: HistoricalRfqQuoteResult;
  notes: string;
};

export type HistoricalGapRecord = {
  project_id: string;
  issue_code: string;
  issue_summary: string;
  resolved_in_final_quote: boolean;
  notes: string;
};

export type HistoricalKnowledgeBundle = {
  sourceDir: string;
  projects: HistoricalProjectRecord[];
  gapFindings: HistoricalGapRecord[];
  /** Primary store for ranked historical RFQs (`rfq_projects` + quotes). */
  projectsSource: "sqlite" | "jsonl";
  /** Primary store for gap issue rows (`historical_gap_findings` table or CSV file). */
  gapSource: "sqlite" | "csv";
};
