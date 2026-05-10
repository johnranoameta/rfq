"use client";

import { useMemo } from "react";
import type { CaseData } from "@/data/rfqTypes";
import {
  dimensionsCovered,
  MATCH_DIMENSIONS,
} from "@/components/rfq/RfqReferenceMatchPanel";

type ItemRow = NonNullable<CaseData["item_historical_comparison"]>[number];

type CellStatus = "Covered" | "Partial" | "Missing";

function aggregateStatus(covered: number, total: number): CellStatus {
  if (total <= 0) return "Missing";
  if (covered >= total) return "Covered";
  if (covered <= 0) return "Missing";
  return "Partial";
}

export function RfqMatchCoverageMatrix({ caseData }: { caseData: CaseData }) {
  const rows = caseData.item_historical_comparison ?? [];

  const cells = useMemo(() => {
    const items = rows as ItemRow[];
    const total = items.length;
    return MATCH_DIMENSIONS.map((dim) => {
      let hit = 0;
      for (const row of items) {
        const top = row.matches[0];
        if (!top) continue;
        const set = dimensionsCovered(top.reasons);
        if (set.has(dim.key)) hit += 1;
      }
      const st = aggregateStatus(hit, total);
      const note =
        total === 0
          ? "No line items to compare."
          : st === "Covered"
            ? `All ${total} line item${total === 1 ? "" : "s"} credit this dimension in the top reference.`
            : st === "Missing"
              ? `No line item shows this signal on the best historical match.`
              : `${hit} of ${total} line items credit this dimension.`;
      return { dim, status: st, note };
    });
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="ra-card">
        <div className="ra-card-h">
          <span className="ra-card-t">Coverage Matrix</span>
        </div>
        <div className="ra-card-b text-[13px] text-[var(--ra-muted)] py-6 text-center">
          No line-item match data for this RFQ. Run analysis on a workbook that includes historical comparison.
        </div>
      </div>
    );
  }

  return (
    <div className="ra-card">
      <div className="ra-card-h">
        <span className="ra-card-t">Coverage Matrix</span>
        <span className="ra-pill ra-pill-warn text-[11px]">{MATCH_DIMENSIONS.length} dimensions</span>
      </div>
      <div className="ra-card-b">
        <div className="ra-cov-grid">
          {cells.map(({ dim, status, note }) => (
            <div
              key={dim.key}
              className={[
                "ra-cov-cell",
                status === "Covered" ? "ra-cov-ok" : status === "Missing" ? "ra-cov-miss" : "ra-cov-part",
              ].join(" ")}
            >
              <div
                className={[
                  "ra-cov-ic",
                  status === "Covered" ? "ra-cov-ic-ok" : status === "Missing" ? "ra-cov-ic-miss" : "ra-cov-ic-part",
                ].join(" ")}
              >
                {status === "Covered" ? "✓" : status === "Missing" ? "×" : "—"}
              </div>
              <div>
                <div className="ra-cov-dim">
                  {dim.label}{" "}
                  <span
                    className={[
                      "ra-badge",
                      status === "Covered" ? "ra-badge-g" : status === "Missing" ? "ra-badge-r" : "ra-badge-a",
                    ].join(" ")}
                  >
                    {status}
                  </span>
                </div>
                <div className="ra-cov-src">{note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
