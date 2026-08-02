"use client";

import { LogOut } from "lucide-react";

import type { AnalysisSubMode } from "@/components/rfq/RfqAnalysisShell";
import {
  SidebarLists,
  type SidebarListsProps,
} from "@/components/rfq/dashboard/sidebar/SidebarLists";
import { WorkspaceNav } from "@/components/rfq/dashboard/sidebar/WorkspaceNav";
import type { KbSubMode, WorkspaceMode } from "@/components/rfq/dashboard/types";
import { Button } from "@/components/ui/button";

/** Placeholder text depends on what the list below is currently showing. */
function searchPlaceholder(mode: WorkspaceMode, subMode: AnalysisSubMode): string {
  if (mode !== "analysis") return "Search…";
  return subMode === "gaps" ? "Filter classes…" : "Filter RFQs…";
}

export type DashboardSidebarProps = {
  open: boolean;
  onToggle: () => void;
  /** Raw input value; `SidebarLists` receives the normalized form. */
  query: string;
  onQueryChange: (value: string) => void;
  onLogout: () => void;
  nav: React.ComponentProps<typeof WorkspaceNav>;
  lists: SidebarListsProps;
};

export function DashboardSidebar({
  open,
  onToggle,
  query,
  onQueryChange,
  onLogout,
  nav,
  lists,
}: DashboardSidebarProps) {
  return (
    <aside className="ra-sidebar">
      <button
        type="button"
        className="ra-sidebar-toggle"
        aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        onClick={onToggle}
      >
        ‹
      </button>

      <WorkspaceNav {...nav} />

      <div className="ra-divider" />

      <div className="ra-sidebar-search">
        <span className="ra-search-icon" aria-hidden>
          ⌕
        </span>
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={searchPlaceholder(lists.workspaceMode, lists.analysisSubMode)}
          aria-label="Filter sidebar"
        />
      </div>

      <div className="ra-sidebar-scroll">
        <SidebarLists {...lists} />
      </div>

      <div
        className={[
          "shrink-0 border-t border-[var(--ra-border)] bg-[var(--ra-bg)]",
          open ? "p-2" : "p-1.5 flex justify-center",
        ].join(" ")}
      >
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className={[
            "shadow-sm hover:bg-destructive/90",
            open ? "w-full justify-center gap-2" : "h-8 w-8 p-0",
          ].join(" ")}
          aria-label="Log out"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {open ? <span className="text-[12px] font-semibold">Log out</span> : null}
        </Button>
      </div>
    </aside>
  );
}

export type { KbSubMode };
