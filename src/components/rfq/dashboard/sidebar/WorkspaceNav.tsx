"use client";

import type { AnalysisSubMode } from "@/components/rfq/RfqAnalysisShell";
import {
  SidebarNavButton,
  SidebarSubNavButton,
} from "@/components/rfq/dashboard/sidebar/SidebarPrimitives";
import type { KbSubMode, WorkspaceMode } from "@/components/rfq/dashboard/types";

/**
 * Analysis sub-tabs, in display order.
 *
 * These were seven near-identical inline buttons; the only thing that varied
 * was the label and the mode it selects.
 */
const ANALYSIS_SUB_MODES: ReadonlyArray<{ mode: AnalysisSubMode; label: string }> = [
  { mode: "summary", label: "Overview" },
  { mode: "matching", label: "Matching" },
  { mode: "coverage", label: "Coverage" },
  { mode: "gaps", label: "Gap analysis" },
  { mode: "reuse", label: "Reuse guidance" },
  { mode: "bom", label: "BOM Intelligence" },
  { mode: "costing", label: "Costing agent" },
];

export type WorkspaceNavProps = {
  open: boolean;
  workspaceMode: WorkspaceMode;
  kbSubMode: KbSubMode;
  analysisSubMode: AnalysisSubMode;
  historicalCount: number;
  newCount: number;
  savedAnalysesCount: number;
  processingCount: number;
  showPortfolio: boolean;
  showSupplierDb: boolean;
  showQuoteHistory: boolean;
  onSelectKb: (subMode: KbSubMode) => void;
  onSelectInquiry: () => void;
  onSelectSupplierDb: () => void;
  onSelectAnalysis: (subMode: AnalysisSubMode) => void;
  onSelectLibrary: () => void;
  onSelectPortfolio: () => void;
};

export function WorkspaceNav({
  open,
  workspaceMode,
  kbSubMode,
  analysisSubMode,
  historicalCount,
  newCount,
  savedAnalysesCount,
  processingCount,
  showPortfolio,
  showSupplierDb,
  showQuoteHistory,
  onSelectKb,
  onSelectInquiry,
  onSelectSupplierDb,
  onSelectAnalysis,
  onSelectLibrary,
  onSelectPortfolio,
}: WorkspaceNavProps) {
  const inKbGroup = workspaceMode === "kb" || workspaceMode === "inquiry";
  const subModes = showQuoteHistory
    ? [...ANALYSIS_SUB_MODES, { mode: "quote" as const, label: "Quote & history" }]
    : ANALYSIS_SUB_MODES;

  return (
    <div className="ra-sidebar-section">
      <div className="ra-sidebar-label">Workspace</div>

      <SidebarNavButton
        active={inKbGroup}
        onClick={() => onSelectKb("browse")}
        label="Knowledge Base"
        badge={historicalCount + newCount}
      />
      {inKbGroup && open ? (
        <div className="ra-nav-submenu" role="group" aria-label="Knowledge base sections">
          <SidebarSubNavButton
            active={workspaceMode === "kb" && kbSubMode === "browse"}
            onClick={() => onSelectKb("browse")}
            label="Historical"
            badge={historicalCount}
          />
          <SidebarSubNavButton
            active={workspaceMode === "kb" && kbSubMode === "training"}
            onClick={() => onSelectKb("training")}
            label="Processing"
            badge={newCount}
            badgeTone="warn"
          />
          <SidebarSubNavButton
            active={workspaceMode === "inquiry"}
            onClick={onSelectInquiry}
            label="Inquiry (Chat)"
          />
        </div>
      ) : null}

      {showSupplierDb ? (
        <SidebarNavButton
          active={workspaceMode === "supplierdb"}
          onClick={onSelectSupplierDb}
          label={<>Supplier &amp; Part DB</>}
        />
      ) : null}

      <SidebarNavButton
        active={workspaceMode === "analysis"}
        onClick={() => onSelectAnalysis("matching")}
        label="Processing"
        badge={processingCount}
      />
      {workspaceMode === "analysis" && open ? (
        <div className="ra-nav-submenu" role="group" aria-label="Analysis sections">
          {subModes.map(({ mode, label }) => (
            <SidebarSubNavButton
              key={mode}
              active={analysisSubMode === mode}
              onClick={() => onSelectAnalysis(mode)}
              label={label}
            />
          ))}
        </div>
      ) : null}

      <SidebarNavButton
        active={workspaceMode === "library"}
        onClick={onSelectLibrary}
        label="Saved analyses"
        badge={savedAnalysesCount}
      />
      {showPortfolio ? (
        <SidebarNavButton
          active={workspaceMode === "portfolio"}
          onClick={onSelectPortfolio}
          label="Portfolio"
        />
      ) : null}
    </div>
  );
}
