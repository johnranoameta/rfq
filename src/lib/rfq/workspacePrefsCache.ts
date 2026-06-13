import type { AnalysisSelection, AnalysisSubMode } from "@/components/rfq/RfqAnalysisShell";

const KEY = "rfq-agent-workspace-prefs-v1";

export type WorkspaceMode = "kb" | "analysis" | "inquiry" | "library" | "portfolio";

export type WorkspacePrefs = {
  workspaceMode: WorkspaceMode;
  analysisSubMode: AnalysisSubMode;
  analysisSelection: AnalysisSelection | null;
};

export function loadWorkspacePrefs(): WorkspacePrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspacePrefs;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWorkspacePrefs(prefs: WorkspacePrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* quota */
  }
}
