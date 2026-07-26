export type PriceBreakTier = {
  min_qty: number;
  unit_cost: number;
};

export type SupplierPartRow = {
  id: number;
  part_number: string;
  supplier_id: string;
  source: string;
  currency: string;
  unit_cost: number | null;
  price_breaks_json: string | null;
  quote_date: string | null;
  fetched_at: string | null;
  lead_time: string | null;
  approval_status: string | null;
  created_at: string;
  updated_at: string;
};

export type BomPartRow = {
  id: number;
  rfq_file_id: string;
  supplier_id: string | null;
  customer_program: string | null;
  sub_assembly: string | null;
  ref_designator: string;
  description: string | null;
  quantity: number | null;
  unit_cost: number | null;
  currency: string;
  mfr_part_number: string | null;
  extended_attributes_json: string | null;
  raw_source_ref: string | null;
  created_at: string;
};

export type ResolvedUnitCost = {
  unitCost: number;
  currency: string;
  tierMinQty: number;
  belowMinTier: boolean;
};

export type ExternalPriceFetchResult = {
  tiers: PriceBreakTier[];
  fetchedAt: string;
};

export type CostSourceLabel = "internal" | "external";

export type CostSelectionStatus = "compared" | "internal_only" | "external_only" | "none";

export type CostSelectionResult = {
  status: CostSelectionStatus;
  selected: CostSourceLabel | null;
  quantity: number;
  internal: ResolvedUnitCost | null;
  external: ResolvedUnitCost | null;
  /** Display name of the external source that produced `external` (e.g. "Trustedparts.com"), when present. */
  externalSourceLabel: string | null;
  externalStale: boolean;
  disagreementPct: number | null;
  riskFlag: boolean;
  explanation: string;
};
