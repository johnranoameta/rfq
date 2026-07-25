import type { CostSelectionResult, CostSourceLabel, ResolvedUnitCost } from "@/lib/rfq/costLookupTypes";

/** Percentage gap between internal and Trustedparts costs that triggers a risk flag. Configurable via param. */
export const DISAGREEMENT_RISK_THRESHOLD_PCT = 15;

function fmtCost(r: ResolvedUnitCost): string {
  return `${r.currency} ${r.unitCost.toFixed(4)}`;
}

export function compareCostSources(params: {
  quantity: number;
  internal: ResolvedUnitCost | null;
  trustedparts: ResolvedUnitCost | null;
  trustedpartsStale: boolean;
  trustedpartsFailed?: boolean;
  disagreementThresholdPct?: number;
}): CostSelectionResult {
  const {
    quantity,
    internal,
    trustedparts,
    trustedpartsStale,
    trustedpartsFailed = false,
    disagreementThresholdPct = DISAGREEMENT_RISK_THRESHOLD_PCT,
  } = params;

  if (!internal && !trustedparts) {
    return {
      status: "none",
      selected: null,
      quantity,
      internal: null,
      trustedparts: null,
      trustedpartsStale,
      disagreementPct: null,
      riskFlag: false,
      explanation: trustedpartsFailed
        ? `Trustedparts lookup failed — using internal cost only. No internal cost data is available either at qty ${quantity}.`
        : `No cost data available from either source at qty ${quantity}.`,
    };
  }

  if (internal && !trustedparts) {
    const explanation = trustedpartsFailed
      ? `Trustedparts lookup failed — using internal cost only: ${fmtCost(internal)} @ ${quantity} pcs (tier ${internal.tierMinQty}+).`
      : `Only internal cost data available: ${fmtCost(internal)} @ ${quantity} pcs (tier ${internal.tierMinQty}+). No Trustedparts data to compare.`;
    return {
      status: "internal_only",
      selected: "internal",
      quantity,
      internal,
      trustedparts: null,
      trustedpartsStale,
      disagreementPct: null,
      riskFlag: false,
      explanation,
    };
  }

  if (!internal && trustedparts) {
    return {
      status: "trustedparts_only",
      selected: "trustedparts",
      quantity,
      internal: null,
      trustedparts,
      trustedpartsStale,
      disagreementPct: null,
      riskFlag: false,
      explanation: `Only Trustedparts cost data available: ${fmtCost(trustedparts)} @ ${quantity} pcs (tier ${trustedparts.tierMinQty}+). No internal quote to compare.${
        trustedpartsStale ? " (cached price may be stale)" : ""
      }`,
    };
  }

  // Both present.
  const a = internal as ResolvedUnitCost;
  const b = trustedparts as ResolvedUnitCost;
  const selected: CostSourceLabel = b.unitCost < a.unitCost ? "trustedparts" : "internal";
  const winner = selected === "trustedparts" ? b : a;
  const loser = selected === "trustedparts" ? a : b;
  const higher = Math.max(a.unitCost, b.unitCost);
  const lower = Math.min(a.unitCost, b.unitCost);
  const disagreementPct = higher === 0 ? 0 : ((higher - lower) / higher) * 100;
  const riskFlag = disagreementPct > disagreementThresholdPct;

  const winnerLabel = selected === "trustedparts" ? "Trustedparts" : "internal";
  const loserLabel = selected === "trustedparts" ? "internal" : "Trustedparts";
  let explanation =
    `${winnerLabel} selected — ${fmtCost(winner)} @ ${quantity} pcs beats ${loserLabel} ${fmtCost(loser)} @ ${quantity} pcs ` +
    `(${disagreementPct.toFixed(1)}% difference).`;
  if (riskFlag) {
    explanation += ` Sources disagree by more than ${disagreementThresholdPct}% — flagged for review rather than silently using the lower number.`;
  }
  if (trustedpartsStale) {
    explanation += " Trustedparts price is cached and may be stale.";
  }

  return {
    status: "compared",
    selected,
    quantity,
    internal: a,
    trustedparts: b,
    trustedpartsStale,
    disagreementPct,
    riskFlag,
    explanation,
  };
}
