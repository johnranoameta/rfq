"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnalysisResultDump } from "@/components/rfq/upload/AnalysisResultDump";
import {
  canRunStoredFileAnalysis,
  formatBytes,
  type PipelineState,
  type UploadedPackageFile,
} from "@/components/rfq/upload/uploadTypes";

export type UploadedFileRowProps = {
  f: UploadedPackageFile;
  ps: PipelineState;
  /** Disables the analyse button while any upload is in flight. */
  busy: boolean;
  /** Compact mode hides the inline result dump (Analysis canvas uses the tabs). */
  embedded: boolean;
  onAnalyze: (f: UploadedPackageFile) => void;
};

/**
 * One uploaded workbook: its file metadata, the analysis trigger, and — once
 * analysis has run — the parsed header, line items, specs and raw JSON dump.
 */
export function UploadedFileRow({ f, ps, busy, embedded, onAnalyze }: UploadedFileRowProps) {
  const analyzable = canRunStoredFileAnalysis(f);
  const parsed = ps.status === "ok" ? ps.data.parse.parsed : null;
  const isWorkbook = parsed?.source_form === "four_sheet_workbook";
  const wh = parsed?.workbook_header as Record<string, unknown> | undefined;

  return (
    <li key={f.id} className="space-y-3 border-b border-border/60 pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-foreground/90">
        <span className="font-medium text-foreground">{f.originalName}</span>
        <span className="text-muted-foreground">{formatBytes(f.size)}</span>
        <span className="text-muted-foreground truncate max-w-[200px]" title={f.storedName}>
          {f.storedName}
        </span>
        {analyzable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={busy || ps.status === "loading"}
            onClick={() => void onAnalyze(f)}
          >
            <RefreshCw className="size-3 opacity-80" aria-hidden />
            {ps.status === "loading" ? "Analyzing…" : "Re-run analysis"}
          </Button>
        ) : null}
      </div>

      {analyzable && ps.status === "loading" ? (
        <div className="text-[11px] text-muted-foreground animate-pulse">
          Reading workbook sheets, ranking historical projects, running model-assisted gap analysis…
        </div>
      ) : null}

      {analyzable && ps.status === "error" ? (
        <div className="text-[11px] text-red-600 dark:text-red-300" role="alert">
          {ps.message}
        </div>
      ) : null}

      {analyzable && ps.status === "ok" ? (
        embedded ? (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 border border-emerald-400/30 rounded-md px-3 py-2 bg-emerald-400/10">
            Analysis complete for <strong>{f.originalName}</strong> — use{" "}
            <strong>Active RFQ</strong> to open it, then Overview / Matching / Gap analysis.
          </div>
        ) : (
        <AnalysisResultDump
          data={ps.data}
          isWorkbook={isWorkbook}
          parsed={parsed}
          wh={wh}
        />
        )
      ) : null}
    </li>
  );
}
