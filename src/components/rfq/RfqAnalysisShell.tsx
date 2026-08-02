"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { CaseData } from "@/data/rfqTypes";
import { RfqMatchCoverageMatrix } from "@/components/rfq/RfqMatchCoverageMatrix";
import {
  OverviewTopReferenceCard,
  RfqReferenceMatchPanel,
} from "@/components/rfq/RfqReferenceMatchPanel";
import { RfqWorkbookBomPanel } from "@/components/rfq/RfqWorkbookBomPanel";
import { RfqWorkbookCostingPanel } from "@/components/rfq/RfqWorkbookCostingPanel";
import { RfqWorkbookQuotePanel } from "@/components/rfq/RfqWorkbookQuotePanel";
import { RfqWorkbookReusePanel } from "@/components/rfq/RfqWorkbookReusePanel";
import { RfqWorkbookSummaryPanel } from "@/components/rfq/RfqWorkbookSummaryPanel";
import { isAnalysisSubModuleEnabled } from "@/lib/rfq/workspaceModules";

const showQuoteHistory = isAnalysisSubModuleEnabled("quoteHistory");

export type AnalysisSubMode = "summary" | "matching" | "coverage" | "gaps" | "reuse" | "bom" | "costing" | "quote";

export type AnalysisSelection = { kind: "workbook"; fileId: string; label: string };

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
    <div className="ra-analysis-page flex min-h-0 flex-1 flex-col">
      <div className="ra-analysis-page-scroll">
        <div className="ra-analysis-page-inner">{children}</div>
      </div>
      {uploadSlot ? (
        <div className="ra-analysis-page-upload">
          {expandUpload ? (
            uploadSlot
          ) : (
            <details className="ra-analysis-upload-details">
              <summary>Upload workbook (.xlsx/.xls) or drawing (.tif/.tiff)</summary>
              {uploadSlot}
            </details>
          )}
        </div>
      ) : null}
    </div>
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
  workbookUploadSlot,
}: RfqAnalysisShellProps) {
  if (!selection) {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot} expandUpload>
        {onLoadDemo ? (
          <Button type="button" variant="secondary" size="sm" onClick={onLoadDemo}>
            Load demo workbook (gap analysis)
          </Button>
        ) : null}
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
        <p className="text-sm text-amber-800 dark:text-amber-200 border border-amber-500/30 rounded-md px-3 py-2">
          {sessionNotice}
        </p>
      </AnalysisPageLayout>
    );
  }

  if (!caseData) {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        <p className="text-sm text-[var(--ra-muted)]">No analysis data for this workbook yet.</p>
      </AnalysisPageLayout>
    );
  }

  if (subMode === "summary") {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
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
        {isDemoWorkbook ? <DemoWorkbookBanner /> : null}
        <div className="ra-canvas-top !pt-0 !pb-2">
          <div className="ra-canvas-title truncate">Reuse guidance</div>
          <div className="ra-canvas-sub truncate">{caseData.title}</div>
        </div>
        <RfqWorkbookReusePanel
          caseData={caseData}
          onOpenMatches={() => onNavigateSubMode?.("matching")}
          onOpenQuote={showQuoteHistory ? () => onNavigateSubMode?.("quote") : undefined}
        />
      </AnalysisPageLayout>
    );
  }

  if (subMode === "bom") {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {isDemoWorkbook ? <DemoWorkbookBanner /> : null}
        <div className="ra-canvas-top !pt-0 !pb-2">
          <div className="ra-canvas-title truncate">BOM Intelligence</div>
          <div className="ra-canvas-sub truncate">{caseData.title}</div>
        </div>
        <RfqWorkbookBomPanel fileId={selection.fileId} />
      </AnalysisPageLayout>
    );
  }

  if (subMode === "costing") {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
        {isDemoWorkbook ? <DemoWorkbookBanner /> : null}
        <div className="ra-canvas-top !pt-0 !pb-2">
          <div className="ra-canvas-title truncate">Costing agent</div>
          <div className="ra-canvas-sub truncate">{caseData.title}</div>
        </div>
        <RfqWorkbookCostingPanel
          caseData={caseData}
          fileId={selection.fileId}
          onOpenBom={() => onNavigateSubMode?.("bom")}
        />
      </AnalysisPageLayout>
    );
  }

  if (showQuoteHistory && subMode === "quote") {
    return (
      <AnalysisPageLayout uploadSlot={workbookUploadSlot}>
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
