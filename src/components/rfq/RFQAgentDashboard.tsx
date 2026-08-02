"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { logout as clearAuthSession } from "@/components/auth/rfqAuth";
import { RfqPackageUpload } from "@/components/rfq/RfqPackageUpload";
import { RfqWorkbookGapsPanel } from "@/components/rfq/RfqWorkbookGapsPanel";
import { DashboardCanvas } from "@/components/rfq/dashboard/DashboardCanvas";
import { DashboardHeader } from "@/components/rfq/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/rfq/dashboard/DashboardSidebar";
import { useAnalysisStatus } from "@/components/rfq/dashboard/hooks/useAnalysisStatus";
import { useBodyScrollLock } from "@/components/rfq/dashboard/hooks/useBodyScrollLock";
import { useExtractPackages } from "@/components/rfq/dashboard/hooks/useExtractPackages";
import {
  showRaToast,
  useGapDocumentActions,
} from "@/components/rfq/dashboard/hooks/useGapDocumentActions";
import { useKbCatalog } from "@/components/rfq/dashboard/hooks/useKbCatalog";
import { useRfqWorkspace } from "@/components/rfq/dashboard/hooks/useRfqWorkspace";
import { normalizeSidebarQuery } from "@/components/rfq/dashboard/sidebarFilters";
import type { KbSubMode, WorkspaceMode } from "@/components/rfq/dashboard/types";
import { DEFAULT_DEMO_UPLOAD, isPreloadedDemoUpload } from "@/data/sampleRfqPipeline";
import { filterGapFindings } from "@/lib/rfq/filterGapFindings";
import { KB_CLASS_COUNT } from "@/lib/rfq/kbCanonicalClasses";
import { isAnalysisSubModuleEnabled, isWorkspaceModuleEnabled } from "@/lib/rfq/workspaceModules";

import "./rfq-assistant.css";

const showPortfolio = isWorkspaceModuleEnabled("portfolio");
const showSupplierDb = isWorkspaceModuleEnabled("supplierdb");
const showQuoteHistory = isAnalysisSubModuleEnabled("quoteHistory");

/**
 * Composition root for the RFQ workspace.
 *
 * State lives in the hooks under `dashboard/hooks`; markup lives in
 * `DashboardHeader` / `DashboardSidebar` / `DashboardCanvas`. This file only
 * wires the two together.
 */
export default function RFQAgentDashboard() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarQuery, setSidebarQuery] = useState("");
  /** Owned here because both `useKbCatalog` and `useRfqWorkspace` read them. */
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("kb");
  const [kbSubMode, setKbSubMode] = useState<KbSubMode>("browse");

  useBodyScrollLock();

  const extract = useExtractPackages();
  const analysisStatus = useAnalysisStatus();

  const kb = useKbCatalog();

  const ws = useRfqWorkspace({
    showPortfolio,
    showQuoteHistory,
    workspaceMode,
    setWorkspaceMode,
    extractPackages: extract.packages,
    selectedExtractKey: extract.selectedKey,
    setSelectedExtractKey: extract.setSelectedKey,
    refreshCatalog: kb.refresh,
    setCatalog: kb.setCatalog,
  });

  const gapDocs = useGapDocumentActions(ws.setSession);

  const openKbTraining = useCallback(() => {
    setWorkspaceMode("kb");
    setKbSubMode("training");
  }, []);

  const gapFindingsFiltered = useMemo(
    () => filterGapFindings(ws.caseData, ws.gapFilter),
    [ws.caseData, ws.gapFilter],
  );

  const gapsPanel = useMemo(() => {
    if (!ws.caseData || ws.resolvedSelection?.kind !== "workbook") return null;
    return (
      <RfqWorkbookGapsPanel
        caseData={ws.caseData}
        gapFilter={ws.gapFilter}
        setGapFilter={ws.setGapFilter}
        gapFindingsFiltered={gapFindingsFiltered}
        supplyDocError={gapDocs.error}
        supplyDocBusySlot={gapDocs.busySlot}
        onSupplyMissingDoc={gapDocs.supply}
        onRemoveSuppliedDoc={(slotName, rule) => {
          gapDocs.remove(slotName, rule);
          showRaToast("Upload removed — gap reopened");
        }}
        onFinalizeGapDoc={(slotName, rule) => {
          const nextRisk = gapDocs.finalize(slotName, rule);
          showRaToast(
            nextRisk != null
              ? `Document finalized — risk score now ${nextRisk}`
              : "Document finalized for this gap",
          );
        }}
        onWorkflowChange={(rule, status) => {
          ws.setSession((prev) =>
            prev?.caseData
              ? {
                  ...prev,
                  caseData: {
                    ...prev.caseData,
                    gap_workflow: { ...prev.caseData.gap_workflow, [rule]: status },
                  },
                }
              : prev,
          );
        }}
        onOpenDocuments={() => setWorkspaceMode("library")}
      />
    );
  }, [ws, gapFindingsFiltered, gapDocs]);

  /** An unknown fileId falls back to the demo upload, matching the previous inline check. */
  const isDemoWorkbook = useMemo(() => {
    const sel = ws.resolvedSelection;
    if (sel?.kind !== "workbook") return false;
    return isPreloadedDemoUpload(
      ws.uploadedRfqs.find((u) => u.id === sel.fileId) ?? DEFAULT_DEMO_UPLOAD,
    );
  }, [ws.resolvedSelection, ws.uploadedRfqs]);

  const historicalCount =
    (kb.catalog?.seed_projects?.length ?? 0) + (kb.catalog?.historical_uploads?.length ?? 0);
  const newCount = extract.packages.length + ws.uploadedRfqs.length;
  const isKbTraining = workspaceMode === "kb" && kbSubMode === "training";

  return (
    <div
      className={["rfq-assistant rfq-assistant-app", sidebarOpen ? "" : "collapsed"].join(" ")}
      style={{ fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif" }}
    >
      <DashboardHeader
        kbClassCount={kb.catalog?.kb_categories?.length ?? KB_CLASS_COUNT}
        historicalCount={historicalCount}
        newCount={newCount}
        trainingPackage={isKbTraining ? extract.selected : null}
        workspaceMode={workspaceMode}
        onOpenKnowledgeBase={() => {
          setWorkspaceMode("kb");
          setKbSubMode("browse");
        }}
        onOpenChat={() => setWorkspaceMode("inquiry")}
      />

      <div className="rfq-assistant-body">
        <DashboardSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          query={sidebarQuery}
          onQueryChange={setSidebarQuery}
          onLogout={() => {
            clearAuthSession();
            router.push("/login");
          }}
          nav={{
            open: sidebarOpen,
            workspaceMode: workspaceMode,
            kbSubMode: kbSubMode,
            analysisSubMode: ws.analysisSubMode,
            historicalCount,
            newCount,
            savedAnalysesCount: kb.catalog?.upload_analyses?.length ?? 0,
            processingCount: newCount,
            showPortfolio,
            showSupplierDb,
            showQuoteHistory,
            onSelectKb: (subMode) => {
              setWorkspaceMode("kb");
              setKbSubMode(subMode);
            },
            onSelectInquiry: () => setWorkspaceMode("inquiry"),
            onSelectSupplierDb: () => setWorkspaceMode("supplierdb"),
            onSelectAnalysis: (subMode) => {
              setWorkspaceMode("analysis");
              ws.setAnalysisSubMode(subMode);
            },
            onSelectLibrary: () => setWorkspaceMode("library"),
            onSelectPortfolio: () => setWorkspaceMode("portfolio"),
          }}
          lists={{
            open: sidebarOpen,
            query: normalizeSidebarQuery(sidebarQuery),
            pipelineBusy: ws.pipelineBusy,
            workspaceMode: workspaceMode,
            kbSubMode: kbSubMode,
            analysisSubMode: ws.analysisSubMode,
            showPortfolio,
            kbBuckets: kb.buckets,
            kbSelectedSlug: kb.selectedSlug,
            onSelectKbBucket: kb.setSelectedSlug,
            extractPackages: extract.packages,
            selectedExtractKey: extract.selectedKey,
            onSelectTrainingPackage: (key) => {
              setWorkspaceMode("kb");
              setKbSubMode("training");
              extract.setSelectedKey(key);
            },
            onRemoveExtractPackage: (pkg) => void extract.remove(pkg),
            onSelectAnalysisWord: ws.selectWordPackage,
            uploadedRfqs: ws.uploadedRfqs,
            userWorkbookUploads: ws.userWorkbookUploads,
            analysisSelection: ws.resolvedSelection,
            activeSessionFileId: ws.session?.file.id,
            statusFor: (fileId) => analysisStatus.byFileId[fileId],
            dotClassFor: analysisStatus.dotClassFor,
            onSelectWorkbook: ws.selectWorkbook,
            onOpenDemo: ws.openDemoWorkbookAnalysis,
            selectedExtractPackage: extract.selected,
          }}
        />

        <DashboardCanvas
          pipelineBusy={ws.pipelineBusy}
          workspaceMode={workspaceMode}
          kbSubMode={kbSubMode}
          showPortfolio={showPortfolio}
          showSupplierDb={showSupplierDb}
          selectedExtractKey={extract.selectedKey}
          selectedExtractPackage={extract.selected}
          activeSessionFileId={ws.session?.file.id ?? null}
          onSelectedExtractKeyChange={extract.setSelectedKey}
          onExtractPackagesChange={extract.setPackages}
          onReloadExtractPackages={() => void extract.reload()}
          kbSelectedBucket={kb.selectedBucket}
          onOpenKbTraining={openKbTraining}
          analysisSubMode={ws.analysisSubMode}
          analysisSelection={ws.resolvedSelection}
          caseData={ws.caseData}
          sessionNotice={ws.sessionNotice}
          loading={ws.sidebarLoadBusy}
          gapsPanel={gapsPanel}
          isDemoWorkbook={isDemoWorkbook}
          onLoadDemo={() => ws.openDemoWorkbookAnalysis("summary")}
          onNavigateSubMode={ws.setAnalysisSubMode}
          workbookUploadSlot={
            <RfqPackageUpload
              embedded
              onUploaded={ws.handleUploaded}
              onAnalyzed={ws.handleAnalyzed}
              onAnalysisStatusChange={analysisStatus.handleEvent}
            />
          }
        />
      </div>
    </div>
  );
}
