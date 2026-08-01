import type { AnalysisSelection, AnalysisSubMode } from "@/components/rfq/RfqAnalysisShell";
import { readJsonStorage, writeJsonStorage } from "@/lib/core/jsonStorage";

const KEY = "rfq-agent-workspace-prefs-v1";

export type WorkspaceMode = "kb" | "analysis" | "inquiry" | "library" | "portfolio" | "supplierdb";

export type WorkspacePrefs = {
  workspaceMode: WorkspaceMode;
  analysisSubMode: AnalysisSubMode;
  analysisSelection: AnalysisSelection | null;
};

export function loadWorkspacePrefs(): WorkspacePrefs | null {
  return readJsonStorage<WorkspacePrefs | null>(KEY, null, (p) => !!p && typeof p === "object");
}

export function saveWorkspacePrefs(prefs: WorkspacePrefs): void {
  writeJsonStorage(KEY, prefs);
}
