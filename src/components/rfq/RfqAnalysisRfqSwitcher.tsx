"use client";

import type { AnalysisSelection } from "@/components/rfq/RfqAnalysisShell";

export type AnalysisRfqWordOption = {
  key: string;
  label: string;
  detail?: string;
};

export type AnalysisRfqWorkbookOption = {
  id: string;
  label: string;
  isDemo?: boolean;
};

type RfqAnalysisRfqSwitcherProps = {
  selection: AnalysisSelection | null;
  wordPackages: AnalysisRfqWordOption[];
  workbooks: AnalysisRfqWorkbookOption[];
  onSelectWord: (key: string) => void;
  onSelectWorkbook: (id: string) => void;
  compact?: boolean;
};

function selectionValue(sel: AnalysisSelection | null): string {
  if (!sel) return "";
  return sel.kind === "word" ? `word:${sel.packageKey}` : `workbook:${sel.fileId}`;
}

export function RfqAnalysisRfqSwitcher({
  selection,
  wordPackages,
  workbooks,
  onSelectWord,
  onSelectWorkbook,
  compact = false,
}: RfqAnalysisRfqSwitcherProps) {
  const total = wordPackages.length + workbooks.length;
  const value = selectionValue(selection);

  if (total === 0) {
    return (
      <p className="text-xs text-[var(--ra-muted)] border border-[var(--ra-border)] rounded-md px-3 py-2 bg-[var(--ra-card)]">
        No RFQs yet. Upload a Word package under <strong className="text-[var(--ra-text)]">Knowledge Base →
        Training</strong>, or a workbook below.
      </p>
    );
  }

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-2",
        compact ? "" : "border border-[var(--ra-border)] rounded-lg px-3 py-2.5 bg-[var(--ra-card)] shadow-sm",
      ].join(" ")}
    >
      <label
        htmlFor="ra-analysis-rfq-switcher"
        className={[
          "text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ra-muted)] shrink-0",
          compact ? "" : "min-w-[72px]",
        ].join(" ")}
      >
        Active RFQ
      </label>
      <select
        id="ra-analysis-rfq-switcher"
        className="flex-1 min-w-[200px] text-sm border border-[var(--ra-border)] rounded-md px-2.5 py-1.5 bg-[var(--ra-bg)] text-[var(--ra-text)] font-medium"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          if (v.startsWith("word:")) {
            onSelectWord(v.slice(5));
          } else if (v.startsWith("workbook:")) {
            onSelectWorkbook(v.slice(9));
          }
        }}
      >
        {!value ? <option value="">— Select an RFQ —</option> : null}
        {wordPackages.length > 0 ? (
          <optgroup label={`Word packages (${wordPackages.length})`}>
            {wordPackages.map((p) => (
              <option key={p.key} value={`word:${p.key}`}>
                {p.label}
                {p.detail ? ` — ${p.detail}` : ""}
              </option>
            ))}
          </optgroup>
        ) : null}
        {workbooks.length > 0 ? (
          <optgroup label={`Workbook analyses (${workbooks.length})`}>
            {workbooks.map((w) => (
              <option key={w.id} value={`workbook:${w.id}`}>
                {w.isDemo ? "★ " : ""}
                {w.label}
                {w.isDemo ? " — demo (gaps + matching)" : ""}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
      {!compact ? (
        <span className="text-[11px] text-[var(--ra-muted)] hidden sm:inline">
          {total} RFQ{total === 1 ? "" : "s"} · also click items in the sidebar list
        </span>
      ) : null}
    </div>
  );
}
