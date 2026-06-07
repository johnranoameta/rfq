"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { CaseData } from "@/data/rfqTypes";
import WordPackageHistoricalMatch from "@/components/extraction/WordPackageHistoricalMatch";
import { RfqMatchCoverageMatrix } from "@/components/rfq/RfqMatchCoverageMatrix";
import {
  OverviewTopReferenceCard,
  RfqReferenceMatchPanel,
} from "@/components/rfq/RfqReferenceMatchPanel";
import { RfqWorkbookQuotePanel } from "@/components/rfq/RfqWorkbookQuotePanel";
import { RfqWorkbookReusePanel } from "@/components/rfq/RfqWorkbookReusePanel";
import { RfqWorkbookSummaryPanel } from "@/components/rfq/RfqWorkbookSummaryPanel";
import {
  RfqAnalysisRfqSwitcher,
  type AnalysisRfqWordOption,
  type AnalysisRfqWorkbookOption,
} from "@/components/rfq/RfqAnalysisRfqSwitcher";

export type AnalysisSubMode = "summary" | "matching" | "coverage" | "gaps" | "reuse" | "quote";

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
  isDemoWorkbook?: boolean;
  onLoadDemo?: () => void;
  onNavigateSubMode?: (mode: AnalysisSubMode) => void;
  wordPackages?: AnalysisRfqWordOption[];
  workbooks?: AnalysisRfqWorkbookOption[];
  onSelectWord?: (key: string) => void;
  onSelectWorkbook?: (id: string) => void;
  workbookUploadSlot?: ReactNode;
};

function AnalysisPageLayout({
  children,
  uploadSlot,
  expandUpload = false,
}: {
  children: ReactNode;
  uploadSlot?: ReactNode;
  expandUpload?: boolean;
}) {
  return (
    <div className="ra-analysis-page">
      <div className="ra-analysis-page-scroll">
        <div className="ra-analysis-page-inner">{children}</div>
      </div>
      {uploadSlot ? (
        <div className="ra-analysis-page-upload">
          {expandUpload ? (
            uploadSlot
          ) : (
            <details className="ra-analysis-upload-details">
              <summary>Upload workbook (.xlsx)</summary>
              {uploadSlot}
            </details>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AnalysisSwitcherBar({
  selection,
  wordPackages = [],
  workbooks = [],
  onSelectWord,
  onSelectWorkbook,
}: Pick<
  RfqAnalysisShellProps,
  "selection" | "wordPackages" | "workbooks" | "onSelectWord" | "onSelectWorkbook"
>) {
  if (!onSelectWord || !onSelectWorkbook) return null;
  return (
    <RfqAnalysisRfqSwitcher
      selection={selection}
      wordPackages={wordPackages}
      workbooks={workbooks}
      onSelectWord={onSelectWord}
      onSelectWorkbook={onSelectWorkbook}
    />
  );
}

function DemoWorkbookBanner() {
  return (
    <p className="text-xs text-amber-900 dark:text-amber-100 border border-amber-400/35 bg-amber-400/10 rounded-md px-3 py-2 max-w-3xl">
      <strong className="font-semibold">Demo workbook analysis</strong> — NorthBridge stamping bracket with historical
      matching, coverage matrix, and gap findings. Upload a real 4-sheet Excel workbook to replace this sample.
    </p>
  );
}

function WorkbookHeader({ caseData }: { caseData: CaseData }) {
  return (
    <div className="ra-canvas-top !pt-0 !pb-2">
      <div className="min-w-0">
        <div className="ra-canvas-title truncate">{caseData.title}</div>
        <div className="ra-canvas-sub truncate">
          {caseData.customer} · {caseData.process[0] ?? "—"} · {caseData.rfq_num}
          {caseData.kb_category_label ? ` · KB class: ${caseData.kb_category_label}` : ""}
        </div>
      </div>
    </div>
  );
}

export function RfqAnalysisShell({
  subMode,
  selection,
  caseData,
  sessionNotice,
  loading,
  gapsPanel,
  isDemoWorkbook = false,
  onLoadDemo,
  onNavigateSubMode,
  wordPackages = [],
  workbooks = [],
  onSelectWord,
  onSelectWorkbook,
  workbookUploadSlot,
}: RfqAnalysisShellProps) {
  const switcher = (
    <AnalysisSwitcherBar
      selection={selection}
      wordPackages={wordPackages}
      workbooks={workbooks}
      onSelectWord={onSelectWord}
      onSelectWorkbook={onSelectWorkbook}
    />
  );

  if (!selection) {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot} expandUpload>
        {switcher}
        <p className="text-sm text-[var(--ra-muted)] max-w-xl">
          Pick an RFQ in the <strong className="text-[var(--ra-text)]">Active RFQ</strong> dropdown above, or click a
          row under <strong className="text-[var(--ra-text)]">Word packages</strong> /{" "}
          <strong className="text-[var(--ra-text)]">Workbook analyses</strong> in the sidebar.
        </p>
        {onLoadDemo ? (
          <Button type="button" variant="secondary" size="sm" onClick={onLoadDemo}>
            Load demo workbook (gap analysis)
          </Button>
        ) : null}
      </AnalysisPageLayout>
    );
  }

  if (selection.kind === "word") {
    if (subMode === "matching") {
      return (
        <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
          {switcher}
          <p className="text-xs text-muted-foreground max-w-2xl">
            Word matching compares this upload to <strong className="text-foreground">other Word packages</strong> in
            Training — not the CSV/seed historical knowledge base.
          </p>
          <WordPackageHistoricalMatch packageId={selection.packageKey} packageLabel={selection.label} />
        </AnalysisPageLayout>
      );
    }
    if (subMode === "coverage" || subMode === "reuse" || subMode === "quote") {
      return (
        <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
          {switcher}
          <p className="text-sm text-[var(--ra-muted)]">
            {subMode === "coverage"
              ? "Coverage matrix applies to multi-line workbook analyses."
              : subMode === "reuse"
                ? "Reuse guidance and quote history apply to analyzed workbooks."
                : "Quote & history applies to analyzed workbooks."}{" "}
            For Word packages, use <strong className="text-[var(--ra-text)]">Matching</strong> to compare against other
            Word uploads.
          </p>
        </AnalysisPageLayout>
      );
    }
    if (subMode === "summary") {
      return (
        <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
          {switcher}
          <p className="text-sm text-[var(--ra-muted)]">
            Overview cards apply to analyzed <strong className="text-[var(--ra-text)]">workbooks</strong>. Select the
            demo workbook or upload a 4-sheet Excel file below.
          </p>
        </AnalysisPageLayout>
      );
    }
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {switcher}
        <p className="text-sm text-[var(--ra-muted)] max-w-xl">
          Automated <strong className="text-[var(--ra-text)]">gap analysis</strong> is available for analyzed{" "}
          <strong className="text-[var(--ra-text)]">4-sheet workbooks</strong> today.
        </p>
        <p className="text-sm text-[var(--ra-muted)] max-w-xl">
          For Word RFQs, use <strong className="text-[var(--ra-text)]">Knowledge Base → Inquiry</strong> to ask about
          missing attachments, section fields, and differences vs other uploads.
        </p>
      </AnalysisPageLayout>
    );
  }

  if (loading) {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        <p className="text-sm text-[var(--ra-muted)]">Loading stored analysis…</p>
      </AnalysisPageLayout>
    );
  }

  if (sessionNotice && !caseData) {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {switcher}
        <p className="text-sm text-amber-800 dark:text-amber-200 border border-amber-500/30 rounded-md px-3 py-2">
          {sessionNotice}
        </p>
      </AnalysisPageLayout>
    );
  }

  if (!caseData) {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {switcher}
        <p className="text-sm text-[var(--ra-muted)]">No analysis data for this workbook yet.</p>
      </AnalysisPageLayout>
    );
  }

  if (subMode === "summary") {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {switcher}
        {isDemoWorkbook ? <DemoWorkbookBanner /> : null}
        <WorkbookHeader caseData={caseData} />
        <RfqWorkbookSummaryPanel
          caseData={caseData}
          sessionNotice={sessionNotice}
          onOpenMatches={() => onNavigateSubMode?.("matching")}
        />
      </AnalysisPageLayout>
    );
  }

  if (subMode === "matching") {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {switcher}
        {isDemoWorkbook ? <DemoWorkbookBanner /> : null}
        <WorkbookHeader caseData={caseData} />
        <OverviewTopReferenceCard caseData={caseData} onOpenMatches={() => onNavigateSubMode?.("matching")} />
        <RfqReferenceMatchPanel caseData={caseData} />
      </AnalysisPageLayout>
    );
  }

  if (subMode === "coverage") {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {switcher}
        {isDemoWorkbook ? <DemoWorkbookBanner /> : null}
        <div className="ra-canvas-top !pt-0 !pb-2">
          <div className="ra-canvas-title truncate">{caseData.title}</div>
          <div className="ra-canvas-sub truncate">{selection.label}</div>
        </div>
        <RfqMatchCoverageMatrix caseData={caseData} />
      </AnalysisPageLayout>
    );
  }

  if (subMode === "reuse") {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {switcher}
        {isDemoWorkbook ? <DemoWorkbookBanner /> : null}
        <div className="ra-canvas-top !pt-0 !pb-2">
          <div className="ra-canvas-title truncate">Reuse guidance</div>
          <div className="ra-canvas-sub truncate">{caseData.title}</div>
        </div>
        <RfqWorkbookReusePanel
          caseData={caseData}
          onOpenMatches={() => onNavigateSubMode?.("matching")}
          onOpenQuote={() => onNavigateSubMode?.("quote")}
        />
      </AnalysisPageLayout>
    );
  }

  if (subMode === "quote") {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {switcher}
        {isDemoWorkbook ? <DemoWorkbookBanner /> : null}
        <div className="ra-canvas-top !pt-0 !pb-2">
          <div className="ra-canvas-title truncate">Quote &amp; history</div>
          <div className="ra-canvas-sub truncate">{caseData.title}</div>
        </div>
        <RfqWorkbookQuotePanel caseData={caseData} />
      </AnalysisPageLayout>
    );
  }

  return (
    <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
      {switcher}
      {isDemoWorkbook ? <DemoWorkbookBanner /> : null}
      <div className="ra-canvas-top !pt-0 !pb-2">
        <div className="min-w-0">
          <div className="ra-canvas-title truncate">Gap analysis</div>
          <div className="ra-canvas-sub truncate">
            {caseData.title} · {caseData.rfq_num}
          </div>
        </div>
      </div>
      {gapsPanel}
    </AnalysisPageLayout>
  );
}
