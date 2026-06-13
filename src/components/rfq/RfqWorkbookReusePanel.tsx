"use client";

import { useEffect, useState } from "react";
import type { CaseData, GapWorkflowStatus } from "@/data/rfqTypes";
import { OverviewTopReferenceCard } from "@/components/rfq/RfqReferenceMatchPanel";
import {
  loadReuseGuidancePrefs,
  REUSE_APPLY_SCOPE_OPTIONS,
  reuseScopeSummary,
  saveReuseGuidancePrefs,
  type ReuseApplyScope,
} from "@/lib/rfq/reuseGuidancePrefs";
import { isAnalysisSubModuleEnabled } from "@/lib/rfq/workspaceModules";

const showQuoteHistory = isAnalysisSubModuleEnabled("quoteHistory");

function isGapWorkflowClosed(w: GapWorkflowStatus | undefined): boolean {
  return w === "resolved" || w === "accepted_risk";
}

function showDemoToast(msg: string) {
  const el = document.createElement("div");
  el.className =
    "fixed bottom-5 right-5 z-[200] rounded-lg px-4 py-2 text-[13px] text-white shadow-lg max-w-sm";
  el.style.background = "#0f2340";
  el.textContent = msg;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 2800);
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
  const [applyScope, setApplyScope] = useState<ReuseApplyScope>("active_rfq");
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  useEffect(() => {
    setApplyScope(loadReuseGuidancePrefs().applyScope);
    setPrefsHydrated(true);
  }, []);

  function updateScope(scope: ReuseApplyScope) {
    setApplyScope(scope);
    saveReuseGuidancePrefs({ applyScope: scope });
  }

  const openGaps = c.gap_findings.filter((f) => !isGapWorkflowClosed(c.gap_workflow?.[f.rule]));
  const scopeLabel = reuseScopeSummary(applyScope, c.kb_category_label);
  const selectedScope = REUSE_APPLY_SCOPE_OPTIONS.find((o) => o.id === applyScope);

  function scopeToast(action: string) {
    showDemoToast(`${action} (${scopeLabel}) — demo preview`);
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <details
        className="rounded-xl border border-[var(--ra-border)] bg-[var(--ra-card)]/80 text-[12px] text-[var(--ra-muted)] leading-relaxed group"
        open
      >
        <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-[var(--ra-text)] text-[13px] list-none flex items-center justify-between gap-2">
          <span>How to use Reuse guidance</span>
          <span className="text-[10px] font-mono font-normal uppercase tracking-wider text-[var(--ra-muted)] group-open:hidden">
            Show steps
          </span>
        </summary>
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--ra-border)]/60 pt-3">
          <p>
            This step turns <strong className="text-[var(--ra-text)]">historical matches</strong> and{" "}
            <strong className="text-[var(--ra-text)]">open gaps</strong> into actionable reuse advice before you
            release a quote or reply to the buyer.
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Review the <strong className="text-[var(--ra-text)]">Top Historical Reference</strong> card — the score
              (HIGH / MEDIUM / LOW) tells you how safely you can reuse past pricing and tooling.
            </li>
            <li>
              Check <strong className="text-[var(--ra-text)]">Open actions</strong> on the right — resolve or accept
              gaps in <strong className="text-[var(--ra-text)]">Gap analysis</strong> before reusing numbers
              blindly.
            </li>
            <li>
              Choose <strong className="text-[var(--ra-text)]">Apply guidance to</strong> below — control whether drafts
              reference only this workbook, the whole KB class, or all historical RFQs.
            </li>
            <li>
              Use <strong className="text-[var(--ra-text)]">Generate Draft Response</strong> or{" "}
              <strong className="text-[var(--ra-text)]">Generate Customer Questions</strong>
              {showQuoteHistory ? (
                <>
                  , then open <strong className="text-[var(--ra-text)]">Quote &amp; history</strong> to validate cost
                  bands
                </>
              ) : (
                <> to prepare your buyer reply</>
              )}
              .
            </li>
          </ol>
          <p className="text-[11px]">
            Need more detail on matches? Use{" "}
            <button
              type="button"
              className="text-accent hover:underline font-medium"
              onClick={() => onOpenMatches?.()}
            >
              Matching
            </button>
            {showQuoteHistory && onOpenQuote ? (
              <>
                {" "}
                or{" "}
                <button type="button" className="text-accent hover:underline font-medium" onClick={() => onOpenQuote()}>
                  Quote &amp; history
                </button>
              </>
            ) : null}
            .
          </p>
        </div>
      </details>

      <div className="rounded-xl border border-[var(--ra-border)] bg-background/20 px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-[var(--ra-muted)]">
              Apply guidance to
            </div>
            <p className="mt-1 text-[12px] text-[var(--ra-muted)] max-w-xl leading-snug">
              {prefsHydrated && selectedScope ? selectedScope.hint : "Loading preference…"}
            </p>
          </div>
          <div className="text-[11px] font-mono text-[var(--ra-muted)] shrink-0">
            Active:{" "}
            <span className="text-[var(--ra-text)] font-semibold">{scopeLabel}</span>
          </div>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Apply reuse guidance to"
        >
          {REUSE_APPLY_SCOPE_OPTIONS.map((opt) => {
            const active = applyScope === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={opt.hint}
                onClick={() => updateScope(opt.id)}
                className={[
                  "h-9 px-3 rounded-xl border font-mono text-[11px] transition text-left",
                  active
                    ? "border-accent/60 bg-card ring-1 ring-accent/30 text-foreground"
                    : "border-border bg-background/20 hover:bg-background/30 text-muted-foreground",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {applyScope === "kb_class" && !c.kb_category_label ? (
          <p className="text-[11px] text-amber-800 dark:text-amber-200 border border-amber-400/30 rounded-lg px-3 py-2 bg-amber-400/5">
            This workbook has no KB class assigned yet — scope falls back to historical rows in the same process family
            when you generate drafts.
          </p>
        ) : null}
      </div>

      <div className="ra-two-col">
        <div className="flex flex-col gap-4 min-w-0">
          <OverviewTopReferenceCard caseData={c} onOpenMatches={onOpenMatches ?? (() => {})} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ra-btn ra-btn-primary"
              onClick={() => scopeToast("Draft response generated")}
            >
              Generate Draft Response
            </button>
            <button
              type="button"
              className="ra-btn"
              onClick={() => scopeToast("Customer questions generated")}
            >
              Generate Customer Questions
            </button>
            {showQuoteHistory && onOpenQuote ? (
              <button type="button" className="ra-btn" onClick={() => onOpenQuote()}>
                View Cost Breakdown
              </button>
            ) : null}
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
          <p className="mt-3 pt-3 border-t border-[var(--ra-border)] text-[11px] text-[var(--ra-muted)] leading-snug">
            Generators will use scope: <strong className="text-[var(--ra-text)]">{scopeLabel}</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
