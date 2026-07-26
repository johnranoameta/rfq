import type { CostSelectionResult, CostSourceLabel, ResolvedUnitCost } from "@/lib/rfq/costLookupTypes";

/** Percentage gap between internal and external costs that triggers a risk flag. Configurable via param. */
export const DISAGREEMENT_RISK_THRESHOLD_PCT = 15;

function fmtCost(r: ResolvedUnitCost): string {
  return `${r.currency} ${r.unitCost.toFixed(4)}`;
}

export function compareCostSources(params: {
  quantity: number;
  internal: ResolvedUnitCost | null;
  external: ResolvedUnitCost | null;
  /** Display name of the external source (e.g. "Trustedparts.com"), used in the explanation text. */
  externalSourceLabel: string | null;
  externalStale: boolean;
  externalFailed?: boolean;
  disagreementThresholdPct?: number;
}): CostSelectionResult {
  const {
    quantity,
    internal,
    external,
    externalSourceLabel,
    externalStale,
    externalFailed = false,
    disagreementThresholdPct = DISAGREEMENT_RISK_THRESHOLD_PCT,
  } = params;
  const extLabel = externalSourceLabel || "external";

  if (!internal && !external) {
    return {
      status: "none",
      selected: null,
      quantity,
      internal: null,
      external: null,
      externalSourceLabel,
      externalStale,
      disagreementPct: null,
      riskFlag: false,
      explanation: externalFailed
        ? `${extLabel} lookup failed — using internal cost only. No internal cost data is available either at qty ${quantity}.`
        : `No cost data available from either source at qty ${quantity}.`,
    };
  }

  if (internal && !external) {
    const explanation = externalFailed
      ? `${extLabel} lookup failed — using internal cost only: ${fmtCost(internal)} @ ${quantity} pcs (tier ${internal.tierMinQty}+).`
      : `Only internal cost data available: ${fmtCost(internal)} @ ${quantity} pcs (tier ${internal.tierMinQty}+). No ${extLabel} data to compare.`;
    return {
      status: "internal_only",
      selected: "internal",
      quantity,
      internal,
      external: null,
      externalSourceLabel,
      externalStale,
      disagreementPct: null,
      riskFlag: false,
      explanation,
    };
  }

  if (!internal && external) {
    return {
      status: "external_only",
      selected: "external",
      quantity,
      internal: null,
      external,
      externalSourceLabel,
      externalStale,
      disagreementPct: null,
      riskFlag: false,
      explanation: `Only ${extLabel} cost data available: ${fmtCost(external)} @ ${quantity} pcs (tier ${external.tierMinQty}+). No internal quote to compare.${
        externalStale ? " (cached price may be stale)" : ""
      }`,
    };
  }

  // Both present.
  const a = internal as ResolvedUnitCost;
  const b = external as ResolvedUnitCost;
  const selected: CostSourceLabel = b.unitCost < a.unitCost ? "external" : "internal";
  const winner = selected === "external" ? b : a;
  const loser = selected === "external" ? a : b;
  const higher = Math.max(a.unitCost, b.unitCost);
  const lower = Math.min(a.unitCost, b.unitCost);
  const disagreementPct = higher === 0 ? 0 : ((higher - lower) / higher) * 100;
  const riskFlag = disagreementPct > disagreementThresholdPct;

  const winnerLabel = selected === "external" ? extLabel : "internal";
  const loserLabel = selected === "external" ? "internal" : extLabel;
  let explanation =
    `${winnerLabel} selected — ${fmtCost(winner)} @ ${quantity} pcs beats ${loserLabel} ${fmtCost(loser)} @ ${quantity} pcs ` +
    `(${disagreementPct.toFixed(1)}% difference).`;
  if (riskFlag) {
    explanation += ` Sources disagree by more than ${disagreementThresholdPct}% — flagged for review rather than silently using the lower number.`;
  }
  if (externalStale) {
    explanation += ` ${extLabel} price is cached and may be stale.`;
  }

  return {
    status: "compared",
    selected,
    quantity,
    internal: a,
    external: b,
    externalSourceLabel,
    externalStale,
    disagreementPct,
    riskFlag,
    explanation,
  };
}
