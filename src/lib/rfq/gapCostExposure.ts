import type { GapFinding, GapWorkflowStatus } from "@/data/rfqTypes";

/**
 * Dollar exposure implied by open gap findings.
 *
 * Impact strings are free text written by the rule catalogue and the model, so
 * the numbers are recovered by pattern match rather than being a structured
 * field. Anything unrecognised contributes nothing — silently, because a rule
 * with no dollar figure is normal, not an error.
 */

export type DollarRange = [number, number];

export type ImpactDollars = {
  /** Per-piece cost, e.g. "$0.12–0.18/pc". */
  perPc?: DollarRange;
  /** One-off tooling/NRE, e.g. "$12K–18K". */
  nre?: DollarRange;
};

/**
 * Recognised forms, in precedence order: a per-piece range, a single per-piece
 * figure, a K-suffixed NRE range, then a single K-suffixed NRE figure. Both
 * hyphen (`-`) and en-dash (`–`) separate a range.
 */
export function parseImpactDollars(impact: string): ImpactDollars {
  const pcRange = impact.match(/\$([\d.]+)[–\-]([\d.]+)\/pc/);
  if (pcRange) return { perPc: [parseFloat(pcRange[1]!), parseFloat(pcRange[2]!)] };

  const pcSingle = impact.match(/\$([\d.]+)\/pc/);
  if (pcSingle) {
    const v = parseFloat(pcSingle[1]!);
    return { perPc: [v, v] };
  }

  const nreRange = impact.match(/\$([\d.]+)K[–\-]([\d.]+)K/i);
  if (nreRange) {
    return { nre: [parseFloat(nreRange[1]!) * 1000, parseFloat(nreRange[2]!) * 1000] };
  }

  const nreSingle = impact.match(/\$([\d.]+)K/i);
  if (nreSingle) {
    const v = parseFloat(nreSingle[1]!) * 1000;
    return { nre: [v, v] };
  }

  return {};
}

export type CostExposure = {
  perPc: DollarRange | null;
  nre: DollarRange | null;
};

/**
 * Sums the impact of findings that are still open.
 *
 * `resolved` and `accepted_risk` are excluded — accepting a risk is a decision
 * that it no longer counts against the quote. A finding with no recorded
 * workflow status is treated as open.
 */
export function computeCostExposure(
  findings: GapFinding[],
  workflow: Partial<Record<string, GapWorkflowStatus>> | undefined,
): CostExposure {
  let pcLo = 0;
  let pcHi = 0;
  let nreLo = 0;
  let nreHi = 0;

  for (const f of findings) {
    const wf = workflow?.[f.rule] ?? "open";
    if (wf === "resolved" || wf === "accepted_risk") continue;
    const p = parseImpactDollars(f.impact);
    if (p.perPc) {
      pcLo += p.perPc[0];
      pcHi += p.perPc[1];
    }
    if (p.nre) {
      nreLo += p.nre[0];
      nreHi += p.nre[1];
    }
  }

  return {
    perPc: pcLo > 0 || pcHi > 0 ? [pcLo, pcHi] : null,
    nre: nreLo > 0 || nreHi > 0 ? [nreLo, nreHi] : null,
  };
}

/** Risk-score banding used by the gap panel's summary tiles. */
export function riskTone(score: number): "good" | "warn" | "bad" {
  if (score < 35) return "good";
  if (score < 55) return "warn";
  return "bad";
}
