"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";

import type { ExtractPackageSummary } from "@/components/extraction/RfqWordExtractWorkspace";
import type { WorkspaceMode } from "@/components/rfq/dashboard/types";
import { SettingsMenu } from "@/components/settings/SettingsMenu";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export type DashboardHeaderProps = {
  kbClassCount: number;
  historicalCount: number;
  newCount: number;
  /** Shown only while the KB training workspace is open. */
  trainingPackage: ExtractPackageSummary | null;
  workspaceMode: WorkspaceMode;
  onOpenKnowledgeBase: () => void;
  onOpenChat: () => void;
};

export function DashboardHeader({
  kbClassCount,
  historicalCount,
  newCount,
  trainingPackage,
  workspaceMode,
  onOpenKnowledgeBase,
  onOpenChat,
}: DashboardHeaderProps) {
  return (
    <header className="ra-header">
      <div className="ra-header-brand">
        <div className="ra-brand-logo">R</div>
        <div className="ra-brand-text">
          <div className="ra-brand-title">RFQ Assistant</div>
          <div className="ra-brand-sub">Procurement Intelligence</div>
        </div>
      </div>

      <div className="ra-header-pills min-w-0">
        <span className="ra-hpill">
          <strong>{kbClassCount}</strong>
        </span>
        <span className="ra-hpill">
          <strong>{historicalCount}</strong>
        </span>
        <span className="ra-hpill">
          <strong>{newCount}</strong>
        </span>
        {trainingPackage ? (
          <span className="ra-hpill hidden xl:inline">
            <strong>{trainingPackage.rfq_number ?? trainingPackage.filename}</strong>
            {trainingPackage.section_count > 0 ? ` · ${trainingPackage.section_count} sections` : ""}
          </span>
        ) : null}
      </div>

      <div className="ra-header-actions">
        <Link href="/baseline" className="ra-hbtn hidden lg:inline-flex">
          Baseline object
        </Link>
        <Link
          href="/help"
          className="ra-hbtn inline-flex items-center justify-center gap-1.5 px-2.5 py-2 min-w-9"
          aria-label="Open user guide in a new tab"
          target="_blank"
          rel="noopener noreferrer"
        >
          <CircleHelp className="size-[18px] shrink-0" aria-hidden />
          <span className="text-[11px] sm:text-[12px] font-medium whitespace-nowrap">Guide</span>
        </Link>
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <button type="button" className="ra-hbtn" onClick={onOpenKnowledgeBase}>
          Knowledge base
        </button>
        <button
          type="button"
          className={["ra-hbtn", workspaceMode === "inquiry" ? "ra-hbtn-primary" : ""].join(" ")}
          onClick={onOpenChat}
        >
          Chat
        </button>
        <SettingsMenu />
      </div>
    </header>
  );
}
