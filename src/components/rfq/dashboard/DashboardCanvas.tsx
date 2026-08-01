"use client";

import type { ReactNode } from "react";

import {
  RfqWordExtractWorkspace,
  type ExtractPackageSummary,
} from "@/components/extraction/RfqWordExtractWorkspace";
import { AllRfqsLibrary } from "@/components/rfq/AllRfqsLibrary";
import {
  RfqAnalysisShell,
  type AnalysisSelection,
  type AnalysisSubMode,
} from "@/components/rfq/RfqAnalysisShell";
import { RfqKbInquiryPanel } from "@/components/rfq/RfqKbInquiryPanel";
import { RfqKbMainPanel } from "@/components/rfq/RfqKbMainPanel";
import { RfqPortfolioPanel } from "@/components/rfq/RfqPortfolioPanel";
import { RfqSupplierPartsPanel } from "@/components/rfq/RfqSupplierPartsPanel";
import type { KbSubMode, WorkspaceMode } from "@/components/rfq/dashboard/types";
import type { CaseData } from "@/data/rfqTypes";
import type { KbBucket } from "@/lib/rfq/kbBucketPartition";

/** Panels that sit inside the standard padded canvas box. */
function CanvasBox({ children }: { children: ReactNode }) {
  return <div className="ra-canvas-content min-h-0 flex flex-col">{children}</div>;
}

export type DashboardCanvasProps = {
  pipelineBusy: boolean;
  workspaceMode: WorkspaceMode;
  kbSubMode: KbSubMode;
  showPortfolio: boolean;
  showSupplierDb: boolean;

  selectedExtractKey: string | null;
  selectedExtractPackage: ExtractPackageSummary | null;
  activeSessionFileId: string | null;
  onSelectedExtractKeyChange: (key: string | null) => void;
  onExtractPackagesChange: (packages: ExtractPackageSummary[]) => void;
  onReloadExtractPackages: () => void;

  kbSelectedBucket: KbBucket | null;
  onOpenKbTraining: () => void;

  analysisSubMode: AnalysisSubMode;
  analysisSelection: AnalysisSelection | null;
  caseData: CaseData | null;
  sessionNotice: string | null;
  loading: boolean;
  gapsPanel: ReactNode;
  isDemoWorkbook: boolean;
  onLoadDemo: () => void;
  onNavigateSubMode: (subMode: AnalysisSubMode) => void;
  workbookUploadSlot: ReactNode;
};

/** Renders the main pane for the active workspace. */
export function DashboardCanvas(props: DashboardCanvasProps) {
  return <main className="ra-canvas">{renderPane(props)}</main>;
}

function renderPane(props: DashboardCanvasProps): ReactNode {
  const { pipelineBusy, workspaceMode, kbSubMode, showPortfolio, showSupplierDb } = props;

  if (pipelineBusy) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[var(--ra-muted)] text-sm">
        <div className="ra-mono text-[12px]">Running analysis pipeline…</div>
        <div className="text-[11px] text-center max-w-sm">Parse → gap review → benchmark</div>
      </div>
    );
  }

  if (workspaceMode === "inquiry") {
    return (
      <RfqKbInquiryPanel
        packageId={props.selectedExtractKey}
        packageLabel={props.selectedExtractPackage?.filename ?? null}
        sessionId={props.activeSessionFileId}
      />
    );
  }

  if (workspaceMode === "kb" && kbSubMode === "browse") {
    return props.kbSelectedBucket ? (
      <RfqKbMainPanel
        kbBucket={props.kbSelectedBucket}
        projects={props.kbSelectedBucket.projects}
      />
    ) : (
      <div className="ra-canvas-content text-[var(--ra-muted)] text-sm">Loading knowledge base…</div>
    );
  }

  if (workspaceMode === "library") {
    return (
      <CanvasBox>
        <AllRfqsLibrary />
      </CanvasBox>
    );
  }

  if (showPortfolio && workspaceMode === "portfolio") {
    return (
      <CanvasBox>
        <RfqPortfolioPanel onOpenRfq={props.onOpenKbTraining} />
      </CanvasBox>
    );
  }

  if (showSupplierDb && workspaceMode === "supplierdb") {
    return (
      <CanvasBox>
        <RfqSupplierPartsPanel />
      </CanvasBox>
    );
  }

  if (workspaceMode === "kb" && kbSubMode === "training") {
    return (
      <RfqWordExtractWorkspace
        embedded
        selectedKey={props.selectedExtractKey}
        onSelectedKeyChange={props.onSelectedExtractKeyChange}
        onPackagesChange={props.onExtractPackagesChange}
        onExtractionComplete={(key) => {
          if (key) props.onSelectedExtractKeyChange(key);
          props.onReloadExtractPackages();
        }}
        onPackageDeleted={props.onReloadExtractPackages}
      />
    );
  }

  if (workspaceMode === "analysis") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <RfqAnalysisShell
          subMode={props.analysisSubMode}
          selection={props.analysisSelection}
          caseData={props.analysisSelection?.kind === "workbook" ? props.caseData : null}
          sessionNotice={props.sessionNotice}
          loading={props.loading}
          gapsPanel={props.gapsPanel}
          isDemoWorkbook={props.isDemoWorkbook}
          onLoadDemo={props.onLoadDemo}
          onNavigateSubMode={props.onNavigateSubMode}
          workbookUploadSlot={props.workbookUploadSlot}
        />
      </div>
    );
  }

  return (
    <div className="ra-canvas-content text-[var(--ra-muted)] text-sm px-4">
      Select <span className="font-semibold text-[var(--ra-text)]">Knowledge Base → Processing</span> to upload a
      Word RFQ package, <span className="font-semibold text-[var(--ra-text)]">Inquiry (Chat)</span> to ask
      questions, or <span className="font-semibold text-[var(--ra-text)]">Processing</span> for matching and gaps.
    </div>
  );
}
