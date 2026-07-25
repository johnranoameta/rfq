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

export type ResolvedUnitCost = {
  unitCost: number;
  currency: string;
  tierMinQty: number;
  belowMinTier: boolean;
};

export type TrustedpartsFetchResult = {
  tiers: PriceBreakTier[];
  fetchedAt: string;
};

export type CostSourceLabel = "internal" | "trustedparts";

export type CostSelectionStatus = "compared" | "internal_only" | "trustedparts_only" | "none";

export type CostSelectionResult = {
  status: CostSelectionStatus;
  selected: CostSourceLabel | null;
  quantity: number;
  internal: ResolvedUnitCost | null;
  trustedparts: ResolvedUnitCost | null;
  trustedpartsStale: boolean;
  disagreementPct: number | null;
  riskFlag: boolean;
  explanation: string;
};
