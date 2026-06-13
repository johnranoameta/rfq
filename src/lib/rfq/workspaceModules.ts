/**
 * Which workspace areas appear in the sidebar.
 * Set NEXT_PUBLIC_SHOW_PORTFOLIO=true at build time to show Portfolio again.
 */
export type WorkspaceModuleId = "kb" | "inquiry" | "analysis" | "library" | "portfolio";

/** Analysis sub-views (tabs under Analysis). */
export type AnalysisSubModuleId = "quoteHistory";

const MODULE_DEFAULTS: Record<WorkspaceModuleId, boolean> = {
  kb: true,
  inquiry: true,
  analysis: true,
  library: true,
  portfolio: process.env.NEXT_PUBLIC_SHOW_PORTFOLIO === "true",
};

const ANALYSIS_SUB_MODULE_DEFAULTS: Record<AnalysisSubModuleId, boolean> = {
  quoteHistory: process.env.NEXT_PUBLIC_SHOW_QUOTE_HISTORY === "true",
};

export function isWorkspaceModuleEnabled(module: WorkspaceModuleId): boolean {
  return MODULE_DEFAULTS[module];
}

export function isAnalysisSubModuleEnabled(module: AnalysisSubModuleId): boolean {
  return ANALYSIS_SUB_MODULE_DEFAULTS[module];
}
