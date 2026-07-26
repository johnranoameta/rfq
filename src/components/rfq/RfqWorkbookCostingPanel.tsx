"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseData } from "@/data/rfqTypes";
import type { BomPartRow, CostSelectionResult } from "@/lib/rfq/costLookupTypes";
import { useBomParts } from "@/lib/rfq/useBomParts";

type LineCostState = {
  row: BomPartRow;
  requiredQty: number;
  result: CostSelectionResult | null;
  loading: boolean;
  error: string | null;
};

type ConfidenceLevel = "High" | "Medium" | "Low" | "None";

function confidenceForResult(result: CostSelectionResult | null): ConfidenceLevel {
  if (!result || result.status === "none") return "None";
  if (result.status === "compared") return result.riskFlag ? "Low" : "High";
  return "Medium";
}

function confidenceBadgeClass(level: ConfidenceLevel): string {
  switch (level) {
    case "High":
      return "ra-badge ra-badge-g";
    case "Medium":
      return "ra-badge ra-badge-b";
    case "Low":
      return "ra-badge ra-badge-r";
    default:
      return "ra-badge ra-badge-a";
  }
}

function selectedUnitCost(result: CostSelectionResult | null): number | null {
  if (!result) return null;
  if (result.selected === "internal") return result.internal?.unitCost ?? null;
  if (result.selected === "external") return result.external?.unitCost ?? null;
  return null;
}

function resultCurrency(result: CostSelectionResult | null): string | null {
  return result?.internal?.currency ?? result?.external?.currency ?? null;
}

function sourceLabel(result: CostSelectionResult | null): string {
  if (!result) return "No cost data";
  switch (result.status) {
    case "compared":
      return result.selected === "external"
        ? `${result.externalSourceLabel || "External"} (vs internal)`
        : `Internal (vs ${result.externalSourceLabel || "external"})`;
    case "internal_only":
      return "Internal only";
    case "external_only":
      return `${result.externalSourceLabel || "External"} only`;
    default:
      return "No cost data";
  }
}

function fmtMoney(currency: string, value: number): string {
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

export function RfqWorkbookCostingPanel({
  caseData,
  fileId,
  onOpenBom,
}: {
  caseData: CaseData;
  fileId: string;
  onOpenBom?: () => void;
}) {
  const { rows: bomRows, loading: bomLoading, error: bomError } = useBomParts(fileId);

  const [states, setStates] = useState<LineCostState[]>([]);

  useEffect(() => {
    let cancelled = false;
    const initial: LineCostState[] = bomRows.map((row) => {
      const requiredQty = Math.max(1, Math.round((row.quantity ?? 1) * (caseData.annual_vol || 1)));
      return { row, requiredQty, result: null, loading: Boolean(row.mfr_part_number), error: null };
    });
    setStates(initial);

    void Promise.all(
      initial.map(async (s, idx) => {
        if (!s.row.mfr_part_number) return;
        try {
          const res = await fetch(
            `/api/rfq/cost-lookup?partNumber=${encodeURIComponent(s.row.mfr_part_number)}&quantity=${encodeURIComponent(String(s.requiredQty))}`,
          );
          const json = (await res.json()) as CostSelectionResult & { error?: string };
          if (!res.ok) throw new Error(json.error || `Lookup failed (${res.status})`);
          if (cancelled) return;
          setStates((prev) => {
            const next = [...prev];
            next[idx] = { ...s, result: json, loading: false, error: null };
            return next;
          });
        } catch (e) {
          if (cancelled) return;
          setStates((prev) => {
            const next = [...prev];
            next[idx] = { ...s, result: null, loading: false, error: e instanceof Error ? e.message : "Lookup failed" };
            return next;
          });
        }
      }),
    );

    return () => {
      cancelled = true;
    };
  }, [bomRows, caseData.annual_vol]);

  const loading = bomLoading || states.some((s) => s.loading);

  const summary = useMemo(() => {
    let low = 0;
    let high = 0;
    let resolvedLines = 0;
    let confidentLines = 0;
    let riskLines = 0;
    let currency: string | null = null;

    for (const s of states) {
      const unit = selectedUnitCost(s.result);
      if (unit == null || !s.result) continue;
      resolvedLines += 1;
      currency ??= resultCurrency(s.result);
      const extended = unit * s.requiredQty;
      low += extended;
      if (s.result.status === "compared" && s.result.internal && s.result.external) {
        const higherUnit = Math.max(s.result.internal.unitCost, s.result.external.unitCost);
        high += higherUnit * s.requiredQty;
      } else {
        high += extended;
      }
      if (confidenceForResult(s.result) !== "Low") confidentLines += 1;
      if (s.result.riskFlag) riskLines += 1;
    }

    const confidencePct = states.length > 0 ? Math.round((confidentLines / states.length) * 100) : 0;

    return { low, high, resolvedLines, confidencePct, riskLines, currency: currency ?? "USD" };
  }, [states]);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="ra-summary-box flex items-start justify-between gap-3 flex-wrap">
        <div>
          Per BOM line, this compares the internal Supplier &amp; Part DB against cached external distributor
          pricing (TrustedParts.com) at the quantity required and selects the lower cost. BOM lines come from{" "}
          <span className="font-semibold">BOM Intelligence</span> — upload or review the source workbook there.
        </div>
        {onOpenBom ? (
          <button type="button" className="ra-btn shrink-0" onClick={onOpenBom}>
            Open BOM Intelligence
          </button>
        ) : null}
      </div>

      {bomError ? <div className="ra-finding ra-finding-hi">{bomError}</div> : null}

      {!bomLoading && bomRows.length === 0 ? (
        <div className="ra-card">
          <div className="ra-card-b text-[12.5px] text-[var(--ra-muted)]">
            No BOM uploaded for this RFQ yet. Go to{" "}
            <span className="font-semibold text-[var(--ra-text)]">BOM Intelligence</span> to upload a suppliers/parts
            workbook — see <code>docs/sample_supplier_and_part_data.xlsx</code> for the expected shape.
          </div>
        </div>
      ) : (
        <>
          <div className="ra-card">
            <div className="ra-card-h">
              <span className="ra-card-t">Costing Agent Estimate</span>
              <span className="ra-badge ra-badge-b">
                Dual-source · {summary.resolvedLines}/{states.length} lines
              </span>
            </div>
            <div className="ra-card-b">
              <div className="ra-kpi-grid" style={{ marginBottom: 14 }}>
                <div className="ra-kpi">
                  <div className="ra-kpi-l">Estimated Program Cost</div>
                  <div className="ra-kpi-v">{loading ? "…" : fmtMoney(summary.currency, summary.low)}</div>
                  <div className="text-[11px] text-[var(--ra-muted)] mt-1">
                    {loading
                      ? "Looking up…"
                      : summary.high > summary.low
                        ? `Range ${fmtMoney(summary.currency, summary.low)} – ${fmtMoney(summary.currency, summary.high)}`
                        : summary.resolvedLines > 0
                          ? "Both sources agree where available"
                          : "No cost data resolved yet"}
                  </div>
                </div>
                <div className="ra-kpi">
                  <div className="ra-kpi-l">Lines Resolved</div>
                  <div className="ra-kpi-v">
                    {summary.resolvedLines} / {states.length}
                  </div>
                  <div className="text-[11px] text-[var(--ra-muted)] mt-1">
                    {summary.riskLines > 0 ? `${summary.riskLines} flagged for disagreement` : "No disagreement flags"}
                  </div>
                </div>
              </div>
              <div className="ra-score-row">
                <div className="ra-score-lab">Confidence</div>
                <div className="ra-score-track">
                  <div className="ra-score-fill" style={{ width: `${summary.confidencePct}%` }} />
                </div>
                <div className="ra-score-pct">{loading ? "…" : `${summary.confidencePct}%`}</div>
              </div>
            </div>
          </div>

          <div className="ra-card">
            <div className="ra-card-h">
              <span className="ra-card-t">BOM Line Costing</span>
            </div>
            <div className="ra-card-b overflow-x-auto">
              <table className="ra-table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Internal</th>
                    <th>External (Trustedparts.com)</th>
                    <th>Selected</th>
                    <th>Qty required</th>
                    <th>Extended Cost</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map((s) => {
                    const level = confidenceForResult(s.result);
                    const unit = selectedUnitCost(s.result);
                    const cur = resultCurrency(s.result) ?? summary.currency;
                    const r = s.result;
                    const internalWon = r?.selected === "internal";
                    const externalWon = r?.selected === "external";
                    const isMockExternal = Boolean(r?.externalSourceLabel?.includes("(mock)"));
                    return (
                      <tr key={s.row.id}>
                        <td>
                          <div className="font-medium">{s.row.description || s.row.ref_designator}</div>
                          <div className="ra-mono text-[11px] text-[var(--ra-muted)]">
                            {s.row.ref_designator}
                            {s.row.mfr_part_number ? ` · ${s.row.mfr_part_number}` : ""}
                          </div>
                        </td>
                        {!s.row.mfr_part_number ? (
                          <td colSpan={3} className="text-[var(--ra-mid)]">
                            No manufacturer part number — cannot compare
                          </td>
                        ) : s.loading ? (
                          <td colSpan={3} className="text-[var(--ra-mid)]">
                            Looking up…
                          </td>
                        ) : s.error ? (
                          <td colSpan={3} className="text-[var(--ra-red)]">
                            {s.error}
                          </td>
                        ) : (
                          <>
                            <td className={["ra-mono", internalWon ? "font-semibold" : ""].join(" ")}>
                              {r?.internal ? fmtMoney(r.internal.currency, r.internal.unitCost) : "no data"}
                            </td>
                            <td className={["ra-mono", externalWon ? "font-semibold" : ""].join(" ")}>
                              {r?.external ? (
                                <span className="inline-flex items-center gap-1.5">
                                  {fmtMoney(r.external.currency, r.external.unitCost)}
                                  {isMockExternal ? <span className="ra-badge ra-badge-a">mock</span> : null}
                                  {r.externalStale ? <span className="ra-badge ra-badge-a">stale</span> : null}
                                </span>
                              ) : (
                                "no data"
                              )}
                            </td>
                            <td>
                              {r?.status === "compared" ? (
                                <span className={r.riskFlag ? "ra-badge ra-badge-r" : "ra-badge ra-badge-g"}>
                                  {externalWon ? "External" : "Internal"} · {r.disagreementPct?.toFixed(1)}% diff
                                </span>
                              ) : (
                                <span className="text-[var(--ra-muted)]">{sourceLabel(r)}</span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="ra-mono">{s.requiredQty.toLocaleString()}</td>
                        <td className="ra-mono">{unit != null ? fmtMoney(cur, unit * s.requiredQty) : "—"}</td>
                        <td>
                          <span className={confidenceBadgeClass(level)}>{level}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ra-card">
            <div className="ra-card-h">
              <span className="ra-card-t">Risk Flags</span>
            </div>
            <div className="ra-card-b">
              {loading ? (
                <div className="text-[12.5px] text-[var(--ra-muted)]">Checking for cost disagreements…</div>
              ) : summary.riskLines === 0 ? (
                <div className="text-[12.5px] text-[var(--ra-muted)]">No cost-disagreement risk flags on this BOM.</div>
              ) : (
                states
                  .filter((s) => s.result?.riskFlag)
                  .map((s) => (
                    <div key={s.row.id} className="ra-finding ra-finding-warn">
                      <strong>{s.row.ref_designator}</strong> — {s.result?.explanation}
                    </div>
                  ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
