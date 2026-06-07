"use client";

import type { CaseData, GapWorkflowStatus } from "@/data/rfqTypes";
import { OverviewTopReferenceCard } from "@/components/rfq/RfqReferenceMatchPanel";

function isGapWorkflowClosed(w: GapWorkflowStatus | undefined): boolean {
  return w === "resolved" || w === "accepted_risk";
}

function showDemoToast(msg: string) {
  const el = document.createElement("div");
  el.className =
    "fixed bottom-5 right-5 z-[200] rounded-lg px-4 py-2 text-[13px] text-white shadow-lg";
  el.style.background = "#0f2340";
  el.textContent = msg;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 2200);
}

export type RfqWorkbookReusePanelProps = {
  caseData: CaseData;
  onOpenMatches?: () => void;
  onOpenQuote?: () => void;
};

export function RfqWorkbookReusePanel({
  caseData: c,
  onOpenMatches,
  onOpenQuote,
}: RfqWorkbookReusePanelProps) {
  const openGaps = c.gap_findings.filter((f) => !isGapWorkflowClosed(c.gap_workflow?.[f.rule]));

  return (
    <div className="ra-two-col">
      <div className="flex flex-col gap-4 min-w-0">
        <OverviewTopReferenceCard caseData={c} onOpenMatches={onOpenMatches ?? (() => {})} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ra-btn ra-btn-primary"
            onClick={() => showDemoToast("Draft response generated (demo).")}
          >
            Generate Draft Response
          </button>
          <button
            type="button"
            className="ra-btn"
            onClick={() => showDemoToast("Customer questions generated (demo).")}
          >
            Generate Customer Questions
          </button>
          <button type="button" className="ra-btn" onClick={() => onOpenQuote?.()}>
            View Cost Breakdown
          </button>
        </div>
      </div>
      <div className="ra-mini">
        <h4>Open actions</h4>
        <ul className="list-none flex flex-col gap-2 text-[var(--ra-mid)] text-[12.5px] leading-snug">
          {openGaps.length === 0 ? (
            <li>— No open gaps; reuse guidance follows the top reference above.</li>
          ) : (
            openGaps.slice(0, 12).map((f) => (
              <li key={f.rule}>— {f.action || f.title}</li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
