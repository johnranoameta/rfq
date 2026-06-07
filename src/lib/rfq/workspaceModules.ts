/**
 * Which workspace areas appear in the sidebar.
 * Set NEXT_PUBLIC_SHOW_PORTFOLIO=true at build time to show Portfolio again.
 */
export type WorkspaceModuleId = "kb" | "inquiry" | "analysis" | "library" | "portfolio";

const MODULE_DEFAULTS: Record<WorkspaceModuleId, boolean> = {
  kb: true,
  inquiry: true,
  analysis: true,
  library: true,
  portfolio: process.env.NEXT_PUBLIC_SHOW_PORTFOLIO === "true",
};

export function isWorkspaceModuleEnabled(module: WorkspaceModuleId): boolean {
  return MODULE_DEFAULTS[module];
}
