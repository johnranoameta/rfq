"use client";

import type { ExtractPackageSummary } from "@/components/extraction/RfqWordExtractWorkspace";
import type { AnalysisSelection, AnalysisSubMode } from "@/components/rfq/RfqAnalysisShell";
import type { UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import type { AnalysisStatusEntry } from "@/components/rfq/dashboard/hooks/useAnalysisStatus";
import {
  SidebarIconTile,
  SidebarNote,
  SidebarSectionLabel,
  SidebarWordPackageRow,
  SidebarWorkbookRow,
} from "@/components/rfq/dashboard/sidebar/SidebarPrimitives";
import {
  kbBucketMatchesQuery,
  uploadMatchesQuery,
  wordPackageMatchesQuery,
} from "@/components/rfq/dashboard/sidebarFilters";
import type { KbSubMode, WorkspaceMode } from "@/components/rfq/dashboard/types";
import { DEFAULT_DEMO_UPLOAD } from "@/data/sampleRfqPipeline";
import type { KbBucket } from "@/lib/rfq/kbBucketPartition";

export type SidebarListsProps = {
  open: boolean;
  /** Already trimmed and lowercased. */
  query: string;
  pipelineBusy: boolean;
  workspaceMode: WorkspaceMode;
  kbSubMode: KbSubMode;
  analysisSubMode: AnalysisSubMode;
  showPortfolio: boolean;

  kbBuckets: KbBucket[];
  kbSelectedSlug: string | null;
  onSelectKbBucket: (slug: string) => void;

  extractPackages: ExtractPackageSummary[];
  selectedExtractKey: string | null;
  onSelectTrainingPackage: (key: string) => void;
  onRemoveExtractPackage: (pkg: ExtractPackageSummary) => void;
  onSelectAnalysisWord: (key: string) => void;

  uploadedRfqs: UploadedPackageFile[];
  userWorkbookUploads: UploadedPackageFile[];
  analysisSelection: AnalysisSelection | null;
  activeSessionFileId: string | undefined;
  statusFor: (fileId: string) => AnalysisStatusEntry | undefined;
  dotClassFor: (upload: UploadedPackageFile, activeFileId: string | undefined) => string;
  onSelectWorkbook: (upload: UploadedPackageFile) => void;
  onOpenDemo: (subMode: AnalysisSubMode) => void;

  selectedExtractPackage: ExtractPackageSummary | null;
};

/** True when the Analysis selection currently points at `fileId`. */
function isWorkbookSelected(selection: AnalysisSelection | null, fileId: string): boolean {
  return selection?.kind === "workbook" && selection.fileId === fileId;
}

/**
 * The sidebar scroll region. Which list renders depends on the active
 * workspace; all of them share the row components from `SidebarPrimitives`.
 */
export function SidebarLists(props: SidebarListsProps) {
  const { open, pipelineBusy, workspaceMode, kbSubMode, analysisSubMode } = props;

  if (pipelineBusy) {
    return (
      <div className="text-[12px] text-[var(--ra-muted)] px-1 py-2">
        {open ? "Running parse → gap review…" : "…"}
      </div>
    );
  }
  if (workspaceMode === "kb" && kbSubMode === "browse") return <KbClassList {...props} />;
  if (workspaceMode === "kb" && kbSubMode === "training") return <KbTrainingList {...props} />;
  if (workspaceMode === "inquiry") return <InquiryNote {...props} />;
  if (workspaceMode === "analysis" && analysisSubMode === "gaps") return <GapWorkbookList {...props} />;
  if (workspaceMode === "analysis") return <AnalysisSourceList {...props} />;
  return <WorkspaceScopeNote {...props} />;
}

function KbClassList({ open, query, kbBuckets, kbSelectedSlug, onSelectKbBucket }: SidebarListsProps) {
  return (
    <>
      {kbBuckets
        .filter((b) => kbBucketMatchesQuery(b, query))
        .map((b) => (
          <button
            key={b.slug}
            type="button"
            className={["ra-kb-item ra-nav-item-btn", kbSelectedSlug === b.slug ? "active" : ""].join(" ")}
            onClick={() => onSelectKbBucket(b.slug)}
          >
            <SidebarIconTile letter={b.letter} background={b.icon_bg} color={b.icon_fg} />
            {open ? (
              <div className="min-w-0 flex-1 text-left">
                <div className="ra-kb-name">{b.label}</div>
                <div className="ra-kb-count">
                  {b.projects.length} RFQ{b.projects.length === 1 ? "" : "s"}
                </div>
              </div>
            ) : null}
          </button>
        ))}
    </>
  );
}

function KbTrainingList({
  open,
  query,
  extractPackages,
  selectedExtractKey,
  onSelectTrainingPackage,
  onRemoveExtractPackage,
  uploadedRfqs,
  statusFor,
  dotClassFor,
  activeSessionFileId,
  onSelectWorkbook,
  onOpenDemo,
}: SidebarListsProps) {
  if (extractPackages.length === 0 && uploadedRfqs.length === 0) {
    return (
      <SidebarNote open={open}>
        No uploads yet. Upload a Word package or workbook in the main panel.
      </SidebarNote>
    );
  }
  return (
    <>
      {extractPackages.length > 0 ? (
        <SidebarSectionLabel open={open}>Word Packages</SidebarSectionLabel>
      ) : null}
      {extractPackages
        .filter((p) => wordPackageMatchesQuery(p, query))
        .map((p) => (
          <SidebarWordPackageRow
            key={p.key}
            pkg={p}
            open={open}
            active={selectedExtractKey === p.key}
            showAttachments
            onSelect={() => onSelectTrainingPackage(p.key)}
            onDelete={() => onRemoveExtractPackage(p)}
          />
        ))}

      {uploadedRfqs.length > 0 ? (
        <SidebarSectionLabel open={open} className="px-2 pt-3 pb-0.5">
          Workbook Analyses
        </SidebarSectionLabel>
      ) : null}
      {uploadedRfqs
        .filter((u) => uploadMatchesQuery(u, query))
        .map((u) => {
          const isDemo = u.id === DEFAULT_DEMO_UPLOAD.id;
          return (
            <SidebarWorkbookRow
              key={`wb-${u.id}`}
              upload={u}
              open={open}
              isDemo={isDemo}
              dotClass={dotClassFor(u, activeSessionFileId)}
              status={statusFor(u.id)}
              onSelect={() => (isDemo ? onOpenDemo("gaps") : onSelectWorkbook(u))}
            />
          );
        })}
    </>
  );
}

function InquiryNote({ open, selectedExtractPackage }: SidebarListsProps) {
  return (
    <SidebarNote open={open}>
      {selectedExtractPackage
        ? `Chat uses all extracted packages; focus: “${selectedExtractPackage.filename}”.`
        : "Chat compares Word RFQs (RFQ1 vs RFQ2). Upload under Processing, then ask in the main panel."}
    </SidebarNote>
  );
}

function GapWorkbookList({
  open,
  query,
  uploadedRfqs,
  analysisSelection,
  activeSessionFileId,
  statusFor,
  dotClassFor,
  onSelectWorkbook,
  onOpenDemo,
}: SidebarListsProps) {
  return (
    <>
      {uploadedRfqs
        .filter((u) => uploadMatchesQuery(u, query))
        .map((u) => {
          const isDemo = u.id === DEFAULT_DEMO_UPLOAD.id;
          return (
            <SidebarWorkbookRow
              key={`gap-wb-${u.id}`}
              upload={u}
              open={open}
              active={isWorkbookSelected(analysisSelection, u.id)}
              isDemo={isDemo}
              dotClass={dotClassFor(u, activeSessionFileId)}
              status={statusFor(u.id)}
              onSelect={() => (isDemo ? onOpenDemo("gaps") : onSelectWorkbook(u))}
            />
          );
        })}
      {open && uploadedRfqs.length === 0 ? (
        <div className="text-[12px] text-[var(--ra-muted)] px-2 py-3 leading-snug">
          No workbook analyses yet. Upload a workbook from the main panel.
        </div>
      ) : null}
    </>
  );
}

function AnalysisSourceList({
  open,
  query,
  analysisSubMode,
  extractPackages,
  userWorkbookUploads,
  analysisSelection,
  activeSessionFileId,
  statusFor,
  dotClassFor,
  onSelectAnalysisWord,
  onSelectWorkbook,
  onOpenDemo,
}: SidebarListsProps) {
  return (
    <>
      {open ? (
        <div className="px-0 pb-2 shrink-0">
          <p className="text-[11px] text-[var(--ra-muted)] leading-snug px-0.5">
            <strong className="text-[var(--ra-text)] font-semibold">Switch RFQ</strong> — click a row below.
          </p>
        </div>
      ) : null}

      {extractPackages.length === 0 && userWorkbookUploads.length === 0 ? (
        <div className="text-[12px] text-[var(--ra-muted)] px-2 py-3 leading-snug">
          {open
            ? "No other RFQs yet. Open the demo workbook below, or upload under Knowledge Base → Processing."
            : "…"}
        </div>
      ) : null}

      <SidebarSectionLabel open={open}>Demo workbook</SidebarSectionLabel>
      <SidebarWorkbookRow
        upload={DEFAULT_DEMO_UPLOAD}
        open={open}
        active={isWorkbookSelected(analysisSelection, DEFAULT_DEMO_UPLOAD.id)}
        isDemo
        dotClass="dot-amber"
        onSelect={() => onOpenDemo(analysisSubMode)}
      />

      {extractPackages.length > 0 ? (
        <SidebarSectionLabel open={open} className="px-2 pt-1 pb-0.5">
          Word packages
        </SidebarSectionLabel>
      ) : null}
      {extractPackages
        .filter((p) => wordPackageMatchesQuery(p, query))
        .map((p) => (
          <SidebarWordPackageRow
            key={`word-${p.key}`}
            pkg={p}
            open={open}
            active={analysisSelection?.kind === "word" && analysisSelection.packageKey === p.key}
            onSelect={() => onSelectAnalysisWord(p.key)}
          />
        ))}

      {userWorkbookUploads.length > 0 ? (
        <SidebarSectionLabel open={open} className="px-2 pt-3 pb-0.5">
          Your workbook analyses
        </SidebarSectionLabel>
      ) : null}
      {userWorkbookUploads
        .filter((u) => uploadMatchesQuery(u, query))
        .map((u) => (
          <SidebarWorkbookRow
            key={`wb-${u.id}`}
            upload={u}
            open={open}
            active={isWorkbookSelected(analysisSelection, u.id)}
            isDemo={false}
            dotClass={dotClassFor(u, activeSessionFileId)}
            status={statusFor(u.id)}
            onSelect={() => onSelectWorkbook(u)}
          />
        ))}
    </>
  );
}

function WorkspaceScopeNote({ open, showPortfolio }: SidebarListsProps) {
  return (
    <SidebarNote open={open}>
      {showPortfolio
        ? "Saved analyses and Portfolio apply to your whole workspace. Open Knowledge Base or Analysis from the menu above."
        : "Saved analyses apply to your whole workspace. Open Knowledge Base or Analysis from the menu above."}
    </SidebarNote>
  );
}
