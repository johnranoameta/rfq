"use client";

import type { ReactNode } from "react";

import type { CaseData } from "@/data/rfqTypes";
import WordPackageHistoricalMatch from "@/components/extraction/WordPackageHistoricalMatch";
import { RfqMatchCoverageMatrix } from "@/components/rfq/RfqMatchCoverageMatrix";
import {
  OverviewTopReferenceCard,
  RfqReferenceMatchPanel,
} from "@/components/rfq/RfqReferenceMatchPanel";

export type AnalysisSubMode = "matching" | "coverage" | "gaps";

export type AnalysisSelection =
  | { kind: "word"; packageKey: string; label: string }
  | { kind: "workbook"; fileId: string; label: string };

type RfqAnalysisShellProps = {
  subMode: AnalysisSubMode;
  selection: AnalysisSelection | null;
  caseData: CaseData | null;
  sessionNotice: string | null;
  loading: boolean;
  gapsPanel: ReactNode;
  workbookUploadSlot?: ReactNode;
};

export function RfqAnalysisShell({
  subMode,
  selection,
  caseData,
  sessionNotice,
  loading,
  gapsPanel,
  workbookUploadSlot,
}: RfqAnalysisShellProps) {
  if (!selection) {
    return (
      <div className="ra-canvas-content space-y-4 px-4 py-6">
        <p className="text-sm text-[var(--ra-muted)] max-w-xl">
          Select a <strong className="text-[var(--ra-text)]">Word package</strong> or{" "}
          <strong className="text-[var(--ra-text)]">workbook analysis</strong> from the sidebar, then use{" "}
          <strong className="text-[var(--ra-text)]">Matching</strong> or <strong className="text-[var(--ra-text)]">Gap
          analysis</strong> in the submenu.
        </p>
        {workbookUploadSlot}
      </div>
    );
  }

  if (selection.kind === "word") {
    if (subMode === "matching") {
      return (
        <div className="ra-canvas-content px-4 py-4">
          <p className="text-xs text-muted-foreground mb-3 max-w-2xl">
            Word matching compares this upload to <strong className="text-foreground">other Word packages</strong> in
            Training — not the CSV/seed historical knowledge base.
          </p>
          <WordPackageHistoricalMatch packageId={selection.packageKey} packageLabel={selection.label} />
        </div>
      );
    }
    if (subMode === "coverage") {
      return (
        <div className="ra-canvas-content px-4 py-6 text-sm text-[var(--ra-muted)]">
          Coverage matrix applies to multi-line <strong className="text-[var(--ra-text)]">workbook</strong> analyses.
          For Word packages, use <strong className="text-[var(--ra-text)]">Matching</strong> to compare against
          historical RFQs.
        </div>
      );
    }
    return (
      <div className="ra-canvas-content px-4 py-6 text-sm text-[var(--ra-muted)] max-w-xl space-y-2">
        <p>
          Automated <strong className="text-[var(--ra-text)]">gap analysis</strong> is available for analyzed{" "}
          <strong className="text-[var(--ra-text)]">4-sheet workbooks</strong> today.
        </p>
        <p>
          For Word RFQs, use <strong className="text-[var(--ra-text)]">Knowledge Base → Inquiry</strong> to ask about
          missing attachments, section fields, and differences vs other uploads.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ra-canvas-content px-4 py-6 text-sm text-[var(--ra-muted)]">Loading stored analysis…</div>
    );
  }

  if (sessionNotice && !caseData) {
    return (
      <div className="ra-canvas-content space-y-4 px-4 py-6">
        <p className="text-sm text-amber-800 dark:text-amber-200 border border-amber-500/30 rounded-md px-3 py-2">
          {sessionNotice}
        </p>
        {workbookUploadSlot}
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="ra-canvas-content px-4 py-6 text-sm text-[var(--ra-muted)]">
        No analysis data for this workbook yet.
      </div>
    );
  }

  if (subMode === "matching") {
    return (
      <div className="ra-canvas-content px-4 py-4 space-y-4">
        <div className="ra-canvas-top !pt-0 !pb-2">
          <div className="min-w-0">
            <div className="ra-canvas-title truncate">{caseData.title}</div>
            <div className="ra-canvas-sub truncate">
              {caseData.customer} · {caseData.process[0] ?? "—"} · {caseData.rfq_num}
              {caseData.kb_category_label ? ` · KB class: ${caseData.kb_category_label}` : ""}
            </div>
          </div>
        </div>
        <OverviewTopReferenceCard caseData={caseData} onOpenMatches={() => {}} />
        <RfqReferenceMatchPanel caseData={caseData} />
      </div>
    );
  }

  if (subMode === "coverage") {
    return (
      <div className="ra-canvas-content px-4 py-4 space-y-4">
        <div className="ra-canvas-top !pt-0 !pb-2">
          <div className="ra-canvas-title truncate">{caseData.title}</div>
          <div className="ra-canvas-sub truncate">{selection.label}</div>
        </div>
        <RfqMatchCoverageMatrix caseData={caseData} />
      </div>
    );
  }

  return (
    <div className="ra-canvas-content px-4 py-4 space-y-4">
      <div className="ra-canvas-top !pt-0 !pb-2">
        <div className="min-w-0">
          <div className="ra-canvas-title truncate">Gap analysis</div>
          <div className="ra-canvas-sub truncate">
            {caseData.title} · {caseData.rfq_num}
          </div>
        </div>
      </div>
      {gapsPanel}
    </div>
  );
}
