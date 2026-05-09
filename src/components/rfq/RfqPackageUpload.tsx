"use client";

import { useCallback, useId, useRef, useState } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type UploadedPackageFile = {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  storedName: string;
};

/** Parsed row is in SQLite only; original upload file may be gone from disk. */
export const STORED_NAME_DB_ONLY = "__db_only__" as const;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function isWorkbookRfqUpload(f: UploadedPackageFile): boolean {
  if (f.storedName === STORED_NAME_DB_ONLY) return false;
  return f.storedName.toLowerCase().endsWith(".xlsx") || f.storedName.toLowerCase().endsWith(".xls");
}

/** 4-sheet workbook on disk — eligible for server parse + gap (not DB-only rows). */
function canRunStoredFileAnalysis(f: UploadedPackageFile): boolean {
  if (f.storedName === STORED_NAME_DB_ONLY) return false;
  return isWorkbookRfqUpload(f);
}

type HistoricalMatchRow = {
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

type HistoricalPerItemRow = {
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

type PipelineState =
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

type RfqPackageUploadProps = {
  onUploaded?: (file: UploadedPackageFile) => void;
  onAnalyzed?: (file: UploadedPackageFile, analysis: FullAnalyzeOk) => void | Promise<void>;
  onAnalysisStatusChange?: (event: AnalysisStatusEvent) => void;
};

export function RfqPackageUpload({ onUploaded, onAnalyzed, onAnalysisStatusChange }: RfqPackageUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadedPackageFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfPipeline, setPdfPipeline] = useState<Record<string, PipelineState>>({});

  const uploadOne = useCallback(async (file: File) => {
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/rfq/upload", {
      method: "POST",
      body,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
      originalName?: string;
      size?: number;
      mimeType?: string;
      storedName?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || `Upload failed (${res.status})`);
    }
    if (
      !data.id ||
      !data.originalName ||
      data.size == null ||
      !data.mimeType ||
      !data.storedName
    ) {
      throw new Error("Unexpected server response");
    }
    return data as UploadedPackageFile;
  }, []);

  const runPackageAnalysis = useCallback(async (f: UploadedPackageFile) => {
    if (f.storedName === STORED_NAME_DB_ONLY) {
      const message =
        "This RFQ was opened from the database only. Re-upload the 4-sheet workbook (.xlsx/.xls) to run analysis again.";
      setPdfPipeline((prev) => ({
        ...prev,
        [f.id]: { status: "error", message },
      }));
      onAnalysisStatusChange?.({ fileId: f.id, status: "error", message });
      return;
    }
    setPdfPipeline((prev) => ({ ...prev, [f.id]: { status: "loading" } }));
    onAnalysisStatusChange?.({ fileId: f.id, status: "analyzing" });
    try {
      if (!isWorkbookRfqUpload(f)) {
        throw new Error("Workbook-only mode: upload a 4-sheet .xlsx/.xls RFQ file.");
      }
      const endpoint = "/api/rfq/analyze-uploaded-workbook";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storedName: f.storedName,
          uploadId: f.id,
          originalName: f.originalName,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as FullAnalyzeOk & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Analysis failed (${res.status})`);
      }
      if (!data.parse?.parsed || !data.historical || !data.gap) {
        throw new Error("Unexpected analysis response");
      }
      setPdfPipeline((prev) => ({
        ...prev,
        [f.id]: {
          status: "ok",
          data: data as FullAnalyzeOk,
        },
      }));
      onAnalysisStatusChange?.({ fileId: f.id, status: "done" });
      await Promise.resolve(onAnalyzed?.(f, data as FullAnalyzeOk));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Analysis failed";
      setPdfPipeline((prev) => ({
        ...prev,
        [f.id]: { status: "error", message },
      }));
      onAnalysisStatusChange?.({ fileId: f.id, status: "error", message });
    }
  }, [onAnalyzed, onAnalysisStatusChange]);

  const onFiles = useCallback(
    async (list: FileList | null) => {
      if (!list?.length) return;
      setError(null);
      setBusy(true);
      try {
        const next: UploadedPackageFile[] = [];
        for (const file of Array.from(list)) {
          const uploaded = await uploadOne(file);
          next.push(uploaded);
          onUploaded?.(uploaded);
          if (canRunStoredFileAnalysis(uploaded)) {
            onAnalysisStatusChange?.({ fileId: uploaded.id, status: "queued" });
          }
        }
        setItems((prev) => [...next, ...prev]);
        for (const uploaded of next) {
          if (canRunStoredFileAnalysis(uploaded)) {
            void runPackageAnalysis(uploaded);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [uploadOne, onUploaded, runPackageAnalysis, onAnalysisStatusChange],
  );

  return (
    <Card className="bg-card/45 border-border border-dashed">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase flex items-center gap-2">
          <Upload className="size-3.5 opacity-80" aria-hidden />
          Upload package file
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0 space-y-3">
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground/90">4-sheet workbook (.xlsx/.xls):</span> after upload, the app runs{" "}
          <span className="font-mono text-[11px]">parse</span> +{" "}
          <span className="font-mono text-[11px]">historical match</span> +{" "}
          <span className="font-mono text-[11px]">OpenAI gap analysis</span> (requires{" "}
          <span className="font-mono">OPENAI_API_KEY</span>, optional <span className="font-mono">OPENAI_MODEL_GAP</span>, and{" "}
          <span className="font-mono">project_files/.../historical_data</span>
          ). Workbooks need sheets <span className="font-mono">Header</span>, <span className="font-mono">Line_Items</span>,{" "}
          <span className="font-mono">Technical_Specs</span>, <span className="font-mono">Supplier_Responses</span> (multiple rows per
          supplier supported).
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            disabled={busy}
            multiple
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading…" : "Choose files"}
          </Button>
        </div>

        {error ? (
          <div className="text-[12px] text-red-600 dark:text-red-300" role="alert">
            {error}
          </div>
        ) : null}

        {items.length > 0 ? (
          <ul className="text-[12px] space-y-4 border border-border rounded-lg p-3 bg-muted/20">
            {items.map((f) => {
              const ps = pdfPipeline[f.id] ?? { status: "idle" as const };
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
                        onClick={() => void runPackageAnalysis(f)}
                      >
                        <RefreshCw className="size-3 opacity-80" aria-hidden />
                        {ps.status === "loading" ? "Analyzing…" : "Re-run analysis"}
                      </Button>
                    ) : null}
                  </div>

                  {analyzable && ps.status === "loading" ? (
                    <div className="text-[11px] text-muted-foreground animate-pulse">
                      Reading workbook sheets, ranking historical projects, running OpenAI gap analysis…
                    </div>
                  ) : null}

                  {analyzable && ps.status === "error" ? (
                    <div className="text-[11px] text-red-600 dark:text-red-300" role="alert">
                      {ps.message}
                    </div>
                  ) : null}

                  {analyzable && ps.status === "ok" ? (
                    <div className="space-y-3">
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {ps.data.parse.mode} · {ps.data.parse.model}
                        {!isWorkbook ? (
                          <>
                            {" "}
                            · text layer ~{ps.data.parse.extractedTextChars} chars
                          </>
                        ) : null}
                      </div>

                      <Card className="bg-background/30 border-border">
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {isWorkbook ? "Workbook header (OEM / region / SOP)" : "Parsed header & commercial"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {isWorkbook && wh ? (
                            <>
                              {[
                                ["RFQ id", wh.rfq_id],
                                ["Customer", wh.customer],
                                ["Region", wh.region],
                                ["Annual volume", wh.annual_volume],
                                ["Currency", wh.currency],
                                ["SOP", wh.sop],
                              ].map(([k, v]) => (
                                <div key={String(k)} className="flex gap-2 border-b border-border/40 pb-1">
                                  <span className="text-muted-foreground shrink-0 w-[100px]">{String(k)}</span>
                                  <span className="font-mono text-foreground/90 break-all">
                                    {v === null || v === undefined ? "—" : String(v)}
                                  </span>
                                </div>
                              ))}
                            </>
                          ) : (
                            [
                              ["RFQ ref", parsed?.rfq_reference],
                              ["Issue date", parsed?.issue_date],
                              ["Response due", parsed?.response_due_date],
                              ["Quote valid", parsed?.quote_valid_until],
                              ["Customer", parsed?.customer],
                              ["Program", parsed?.program],
                              ["Incoterm", parsed?.incoterm],
                              ["Payment", parsed?.payment_terms],
                              ["PPAP", parsed?.ppap_level],
                              ["APD %", parsed?.annual_reduction_pct],
                              ["Completeness", parsed?.document_completeness],
                            ].map(([k, v]) => (
                              <div key={String(k)} className="flex gap-2 border-b border-border/40 pb-1">
                                <span className="text-muted-foreground shrink-0 w-[100px]">{String(k)}</span>
                                <span className="font-mono text-foreground/90 break-all">
                                  {v === null || v === undefined ? "—" : String(v)}
                                </span>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      {Array.isArray(parsed?.line_items) && (parsed!.line_items as unknown[]).length > 0 ? (
                        <Card className="bg-background/30 border-border overflow-hidden">
                          <CardHeader className="p-3 pb-1">
                            <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Line items ({(parsed!.line_items as unknown[]).length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <Table className="text-[10px]">
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-8">Ln</TableHead>
                                  <TableHead>Part #</TableHead>
                                  <TableHead>Description</TableHead>
                                  <TableHead>Material</TableHead>
                                  <TableHead>Process</TableHead>
                                  {isWorkbook ? (
                                    <TableHead className="text-right">Target</TableHead>
                                  ) : null}
                                  <TableHead className="text-right">Vol</TableHead>
                                  <TableHead>SOP</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(parsed!.line_items as Record<string, unknown>[]).map((row, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-mono">{String(row.line_no ?? idx + 1)}</TableCell>
                                    <TableCell className="font-mono">{String(row.part_number ?? "—")}</TableCell>
                                    <TableCell>{String(row.part_name ?? "—")}</TableCell>
                                    <TableCell className="font-mono">{String(row.material_grade ?? "—")}</TableCell>
                                    <TableCell>{String(row.process ?? "—")}</TableCell>
                                    {isWorkbook ? (
                                      <TableCell className="text-right font-mono">
                                        {typeof row.target_price === "number" ? String(row.target_price) : "—"}
                                      </TableCell>
                                    ) : null}
                                    <TableCell className="text-right font-mono">
                                      {typeof row.annual_volume === "number"
                                        ? row.annual_volume.toLocaleString()
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="font-mono">{String(row.sop_date ?? "—")}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      ) : null}

                      {isWorkbook && Array.isArray(parsed?.suppliers_grouped) ? (
                        <Card className="bg-background/30 border-border overflow-hidden">
                          <CardHeader className="p-3 pb-1">
                            <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Supplier responses (multi-line per supplier)
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <Table className="text-[10px]">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Supplier</TableHead>
                                  <TableHead className="text-right">Lines</TableHead>
                                  <TableHead>Items</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(parsed!.suppliers_grouped as Record<string, unknown>[]).map((g, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-mono">{String(g.supplier ?? "—")}</TableCell>
                                    <TableCell className="text-right font-mono">{String(g.line_count ?? "—")}</TableCell>
                                    <TableCell className="max-w-[240px] truncate" title={String((g.items as unknown[])?.join(", "))}>
                                      {Array.isArray(g.items) ? (g.items as string[]).join(", ") : "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      ) : null}

                      <Card className="bg-background/30 border-border">
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Gap analysis
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-2 text-[11px]">
                          <div className="flex flex-wrap gap-3">
                            <span className="font-semibold">Risk {ps.data.gap.risk_score}</span>
                            {typeof ps.data.gap.risk_score_0_1 === "number" ? (
                              <span className="text-muted-foreground font-mono">
                                ({ps.data.gap.risk_score_0_1.toFixed(2)} normalized)
                              </span>
                            ) : null}
                            <span className="text-muted-foreground">
                              Completeness: {ps.data.gap.completeness_status}
                            </span>
                            {ps.data.gap.gap_model ? (
                              <span className="text-muted-foreground font-mono text-[10px]">{ps.data.gap.gap_model}</span>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{ps.data.gap.summary}</p>
                          {ps.data.gap.item_gaps && ps.data.gap.item_gaps.length > 0 ? (
                            <div className="rounded-md border border-border/80 p-2 bg-muted/15">
                              <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                                Item-level gaps (OpenAI)
                              </div>
                              <ul className="space-y-2 text-[10px]">
                                {ps.data.gap.item_gaps.map((ig) => (
                                  <li key={ig.item}>
                                    <span className="font-semibold">{ig.item}</span>
                                    <ul className="list-disc pl-4 mt-0.5">
                                      {ig.gaps.map((g, i) => (
                                        <li key={i}>{g}</li>
                                      ))}
                                    </ul>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {ps.data.gap.missing_attachments.length ? (
                            <div>
                              <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                                Missing / unresolved
                              </div>
                              <ul className="list-disc pl-4 space-y-0.5 font-mono text-[10px]">
                                {ps.data.gap.missing_attachments.map((m) => (
                                  <li key={m}>{m}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {ps.data.gap.triggered_rules.length ? (
                            <div className="font-mono text-[10px]">
                              Rules: {ps.data.gap.triggered_rules.join(", ")}
                            </div>
                          ) : null}
                          <ul className="list-decimal pl-4 space-y-1 text-muted-foreground">
                            {ps.data.gap.recommended_actions.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                          {ps.data.gap.historical_issues.length ? (
                            <div className="rounded-md border border-border/80 p-2 bg-muted/15">
                              <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                                Historical issues (matched projects)
                              </div>
                              <ul className="space-y-1 text-[10px]">
                                {ps.data.gap.historical_issues.map((h) => (
                                  <li key={`${h.project_id}-${h.issue_code}`}>
                                    <span className="font-mono">{h.project_id}</span> {h.issue_summary}{" "}
                                    <span className="text-muted-foreground">({h.notes})</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>

                      <Card className="bg-background/30 border-border overflow-hidden">
                        <CardHeader className="p-3 pb-1">
                          <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Historical matching ({ps.data.historical.matches.length} of{" "}
                            {ps.data.historical.meta.candidatePool})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          {ps.data.historical.matches.length === 0 ? (
                            <p className="p-3 text-[11px] text-muted-foreground">
                              No scored matches (add material / program / process in parse output to improve
                              ranking).
                            </p>
                          ) : (
                            <Table className="text-[10px]">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>ID</TableHead>
                                  <TableHead>Part</TableHead>
                                  <TableHead>Material</TableHead>
                                  <TableHead className="text-right">Score</TableHead>
                                  <TableHead>Why</TableHead>
                                  <TableHead className="text-right">Price</TableHead>
                                  <TableHead>Award</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {ps.data.historical.matches.map((m) => (
                                  <TableRow key={m.project_id}>
                                    <TableCell className="font-mono">{m.project_id}</TableCell>
                                    <TableCell className="max-w-[140px] truncate" title={String(m.record.rfq.part_number)}>
                                      {String(m.record.rfq.part_number)}
                                    </TableCell>
                                    <TableCell className="font-mono">{String(m.record.rfq.material)}</TableCell>
                                    <TableCell className="text-right font-mono">{m.score}</TableCell>
                                    <TableCell className="max-w-[200px] text-muted-foreground truncate">
                                      {m.reasons.join("; ")}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      ${Number(m.record.quote_result.quoted_piece_price_usd).toFixed(2)}
                                    </TableCell>
                                    <TableCell>{String(m.record.quote_result.award_result)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>

                      {Array.isArray(ps.data.historical.per_item_matches) &&
                      ps.data.historical.per_item_matches.length > 0 ? (
                        <Card className="bg-background/30 border-border overflow-hidden">
                          <CardHeader className="p-3 pb-1">
                            <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              Item historical matching ({ps.data.historical.per_item_matches.length} line items analyzed)
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <Table className="text-[10px]">
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  <TableHead>Part</TableHead>
                                  <TableHead>Top match</TableHead>
                                  <TableHead className="text-right">Similarity</TableHead>
                                  <TableHead>Exact PN</TableHead>
                                  <TableHead className="text-right">Top score</TableHead>
                                  <TableHead className="text-right">Matches</TableHead>
                                  <TableHead className="text-right">Details</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {ps.data.historical.per_item_matches.map((row) => {
                                  const top = row.matches[0];
                                  return (
                                    <TableRow key={`${row.item_index}-${row.item_label}`}>
                                      <TableCell className="font-mono">{row.item_label}</TableCell>
                                      <TableCell className="max-w-[180px] truncate" title={row.part_name || "—"}>
                                        {row.part_name || "—"}
                                      </TableCell>
                                      <TableCell className="font-mono">{top?.project_id ?? "—"}</TableCell>
                                      <TableCell className="text-right font-mono">
                                        {typeof top?.similarity_0_1 === "number"
                                          ? `${Math.round(top.similarity_0_1 * 100)}%`
                                          : "—"}
                                      </TableCell>
                                      <TableCell>{top?.exact_part_number ? "Yes" : "No"}</TableCell>
                                      <TableCell className="text-right font-mono">{top?.score ?? 0}</TableCell>
                                      <TableCell className="text-right font-mono">{row.matches.length}</TableCell>
                                      <TableCell className="text-right">
                                        {row.matches.length > 0 ? (
                                          <details className="inline-block text-left">
                                            <summary className="cursor-pointer text-muted-foreground">Top 3</summary>
                                            <div className="mt-2 rounded border border-border bg-background/80 p-2 w-[440px] max-w-[80vw]">
                                              <Table className="text-[10px]">
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead>ID</TableHead>
                                                    <TableHead>Part</TableHead>
                                                    <TableHead>Material</TableHead>
                                                    <TableHead>Process</TableHead>
                                                    <TableHead className="text-right">Similarity</TableHead>
                                                    <TableHead>Exact PN</TableHead>
                                                    <TableHead className="text-right">Score</TableHead>
                                                    <TableHead className="text-right">Price</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {row.matches.slice(0, 3).map((m) => (
                                                    <TableRow key={`${row.item_index}-${m.project_id}`}>
                                                      <TableCell className="font-mono">{m.project_id}</TableCell>
                                                      <TableCell className="max-w-[120px] truncate" title={String(m.record.rfq.part_name)}>
                                                        {String(m.record.rfq.part_name)}
                                                      </TableCell>
                                                      <TableCell className="font-mono">{String(m.record.rfq.material)}</TableCell>
                                                      <TableCell className="max-w-[120px] truncate" title={String(m.record.rfq.process)}>
                                                        {String(m.record.rfq.process)}
                                                      </TableCell>
                                                      <TableCell className="text-right font-mono">
                                                        {typeof m.similarity_0_1 === "number"
                                                          ? `${Math.round(m.similarity_0_1 * 100)}%`
                                                          : "—"}
                                                      </TableCell>
                                                      <TableCell>{m.exact_part_number ? "Yes" : "No"}</TableCell>
                                                      <TableCell className="text-right font-mono">{m.score}</TableCell>
                                                      <TableCell className="text-right font-mono">
                                                        ${Number(m.record.quote_result.quoted_piece_price_usd).toFixed(2)}
                                                      </TableCell>
                                                    </TableRow>
                                                  ))}
                                                </TableBody>
                                              </Table>
                                            </div>
                                          </details>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      ) : null}

                      <details className="text-[10px] font-mono">
                        <summary className="cursor-pointer text-muted-foreground">Raw parsed JSON</summary>
                        <pre className="mt-2 p-2 rounded border border-border bg-background/40 overflow-x-auto max-h-[180px] overflow-y-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(parsed, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
