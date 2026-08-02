/**
 * Shared shapes and helpers for the workbook upload flow.
 *
 * Split out of `RfqPackageUpload` so the row component can use them without
 * importing the panel (which would be a cycle).
 */

export type UploadedPackageFile = {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  storedName: string;
};

/** Parsed row is in SQLite only; original upload file may be gone from disk. */
export const STORED_NAME_DB_ONLY = "__db_only__" as const;

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function isWorkbookRfqUpload(f: UploadedPackageFile): boolean {
  if (f.storedName === STORED_NAME_DB_ONLY) return false;
  return f.storedName.toLowerCase().endsWith(".xlsx") || f.storedName.toLowerCase().endsWith(".xls");
}

/** 4-sheet workbook on disk — eligible for server parse + gap (not DB-only rows). */
export function canRunStoredFileAnalysis(f: UploadedPackageFile): boolean {
  if (f.storedName === STORED_NAME_DB_ONLY) return false;
  return isWorkbookRfqUpload(f);
}

export type HistoricalMatchRow = {
  project_id: string;
  score: number;
  similarity_0_1?: number;
  exact_part_number?: boolean;
  reasons: string[];
  record: {
    project_id: string;
    rfq: Record<string, unknown>;
    quote_result: Record<string, unknown>;
    notes: string;
  };
};

export type HistoricalPerItemRow = {
  item_index: number;
  item_label: string;
  part_name: string | null;
  criteria: Record<string, unknown>;
  matches: HistoricalMatchRow[];
};

export type FullAnalyzeOk = {
  parse: {
    mode: string;
    model: string;
    extractedTextChars: number;
    parsed: Record<string, unknown>;
    raw: string;
  };
  historical: {
    criteria: Record<string, unknown>;
    matches: HistoricalMatchRow[];
    per_item_matches?: HistoricalPerItemRow[];
    meta: { candidatePool: number };
  };
  gap: {
    risk_score: number;
    risk_score_0_1?: number;
    gap_model?: string;
    completeness_status: string;
    missing_attachments: string[];
    triggered_rules: string[];
    summary: string;
    recommended_actions: string[];
    historical_issues: Array<{
      project_id: string;
      issue_code: string;
      issue_summary: string;
      resolved_in_final_quote: boolean;
      notes: string;
    }>;
    item_gaps?: { item: string; gaps: string[] }[];
  };
};

export type PipelineState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: FullAnalyzeOk }
  | { status: "error"; message: string };

/** Status values surfaced to the dashboard for sidebar progress pills. */
export type AnalysisStatusKind = "queued" | "analyzing" | "done" | "error";

export type AnalysisStatusEvent = {
  fileId: string;
  status: AnalysisStatusKind;
  message?: string;
};
