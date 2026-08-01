"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";

import type { ExtractPackageSummary } from "@/components/extraction/RfqWordExtractWorkspace";
import type { AnalysisStatusKind, UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";

/**
 * The sidebar's repeated building blocks.
 *
 * The dashboard previously inlined each of these: the workbook row appeared
 * four times and the Word-package row twice, all near-identical, and the
 * nav button markup fifteen times. Rendering them from one definition is what
 * keeps the four workbook lists from drifting apart.
 */

/** Renders `children` only when the sidebar is expanded. */
function WhenOpen({ open, children }: { open: boolean; children: ReactNode }) {
  return open ? <div className="min-w-0 flex-1">{children}</div> : null;
}

export function SidebarStatusPill({
  status,
  message,
}: {
  status: AnalysisStatusKind;
  message?: string;
}) {
  const cls =
    status === "error"
      ? "border-red-500/40 bg-red-500/10 dark:text-red-200 text-red-700"
      : status === "analyzing"
        ? "border-cyan-500/40 bg-cyan-500/10 dark:text-cyan-200 text-cyan-800"
        : status === "queued"
          ? "border-amber-400/40 bg-amber-400/10 dark:text-amber-200 text-amber-800"
          : "border-emerald-400/40 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700";
  const label =
    status === "error"
      ? "Error"
      : status === "analyzing"
        ? "Analyzing…"
        : status === "queued"
          ? "Queued"
          : "Analyzed";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider",
        cls,
      ].join(" ")}
      title={message ?? label}
    >
      {label}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
      Demo
    </span>
  );
}

/** Uppercase group heading between sidebar sections; hidden when collapsed. */
export function SidebarSectionLabel({
  open,
  children,
  className = "px-2 pt-2 pb-0.5",
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      className={`${className} text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ra-muted)]`}
    >
      {children}
    </div>
  );
}

/** Muted explanatory text; collapses to an ellipsis when the sidebar is narrow. */
export function SidebarNote({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={[
        "text-[12px] text-[var(--ra-muted)] leading-snug",
        open ? "px-2 py-3" : "px-1 py-2 text-center",
      ].join(" ")}
    >
      {open ? children : "…"}
    </div>
  );
}

export function SidebarNavButton({
  active,
  onClick,
  label,
  badge,
  badgeTone,
}: {
  active: boolean;
  onClick: () => void;
  label: ReactNode;
  badge?: ReactNode;
  badgeTone?: "warn";
}) {
  return (
    <button
      type="button"
      className={["ra-nav-item ra-nav-item-btn", active ? "active" : ""].join(" ")}
      onClick={onClick}
    >
      <span className="ra-nav-text">{label}</span>
      {badge != null ? (
        <span className={["ra-nav-badge", badgeTone === "warn" ? "ra-nav-badge-warn" : ""].join(" ")}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function SidebarSubNavButton({
  active,
  onClick,
  label,
  badge,
  badgeTone,
}: {
  active: boolean;
  onClick: () => void;
  label: ReactNode;
  badge?: ReactNode;
  badgeTone?: "warn";
}) {
  return (
    <button
      type="button"
      className={["ra-nav-subitem", active ? "active" : ""].join(" ")}
      onClick={onClick}
    >
      <span className="ra-nav-text">{label}</span>
      {badge != null ? (
        <span className={["ra-nav-badge", badgeTone === "warn" ? "ra-nav-badge-warn" : ""].join(" ")}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** Square letter tile used by KB class and Word-package rows. */
export function SidebarIconTile({
  letter,
  background,
  color,
  className = "",
}: {
  letter: string;
  background: string;
  color: string;
  className?: string;
}) {
  return (
    <div className={`ra-kb-icon ${className}`} style={{ background, color }}>
      {letter}
    </div>
  );
}

export type WorkbookRowProps = {
  upload: UploadedPackageFile;
  open: boolean;
  active?: boolean;
  isDemo: boolean;
  /** Status dot class; demo rows always render amber. */
  dotClass: string;
  status?: { status: AnalysisStatusKind; message?: string };
  onSelect: () => void;
};

/**
 * One workbook entry. The same row is used by the KB training list, the Gap
 * analysis list, the Analysis list, and the demo entry.
 */
export function SidebarWorkbookRow({
  upload,
  open,
  active = false,
  isDemo,
  dotClass,
  status,
  onSelect,
}: WorkbookRowProps) {
  return (
    <button
      type="button"
      className={["rfq-item w-full text-left", active ? "active" : ""].join(" ")}
      onClick={onSelect}
    >
      <span className={`rfq-dot ${isDemo ? "dot-amber" : dotClass}`} aria-hidden />
      <WhenOpen open={open}>
        <div className="rfq-item-name truncate">{upload.originalName}</div>
        <div className="rfq-item-meta flex items-center gap-2 flex-wrap">
          {isDemo ? (
            <>
              Gap analysis demo
              <DemoBadge />
            </>
          ) : (
            <>
              Workbook
              {status ? <SidebarStatusPill status={status.status} message={status.message} /> : null}
            </>
          )}
        </div>
      </WhenOpen>
    </button>
  );
}

export type WordPackageRowProps = {
  pkg: ExtractPackageSummary;
  open: boolean;
  active: boolean;
  onSelect: () => void;
  /** Appends "· N files" to the meta line (KB training list). */
  showAttachments?: boolean;
  /** Renders the row inside a bordered shell with a trailing delete button. */
  onDelete?: () => void;
};

export function SidebarWordPackageRow({
  pkg,
  open,
  active,
  onSelect,
  showAttachments = false,
  onDelete,
}: WordPackageRowProps) {
  const tile = (
    <SidebarIconTile
      letter="W"
      className="shrink-0"
      background={pkg.has_error ? "var(--ra-red-bg)" : "var(--ra-accent-bg)"}
      color={pkg.has_error ? "var(--ra-red)" : "var(--ra-accent)"}
    />
  );
  const meta = `${pkg.rfq_number ? `#${pkg.rfq_number} · ` : ""}${pkg.section_count} sections${
    showAttachments ? ` · ${pkg.attachment_count} files` : ""
  }`;

  if (!onDelete) {
    return (
      <button
        type="button"
        className={["rfq-item w-full text-left", active ? "active" : ""].join(" ")}
        onClick={onSelect}
      >
        {tile}
        <WhenOpen open={open}>
          <div className="rfq-item-name truncate">{pkg.filename}</div>
          <div className="rfq-item-meta">{meta}</div>
        </WhenOpen>
      </button>
    );
  }

  return (
    <div className="ra-sidebar-package-row flex w-full min-w-0 items-stretch overflow-hidden rounded-[var(--ra-radius)] border border-[var(--ra-border)]">
      <button
        type="button"
        className={[
          "rfq-item min-w-0 flex-1 border-0 bg-transparent text-left flex items-center gap-2",
          active ? "active" : "",
        ].join(" ")}
        onClick={onSelect}
      >
        {tile}
        <WhenOpen open={open}>
          <div className="rfq-item-name truncate">{pkg.filename}</div>
          <div className="rfq-item-meta">{meta}</div>
        </WhenOpen>
      </button>
      <button
        type="button"
        className="ra-sidebar-delete-btn"
        aria-label={`Delete ${pkg.filename}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="size-4 shrink-0" aria-hidden />
      </button>
    </div>
  );
}
