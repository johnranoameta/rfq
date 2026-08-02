"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJson } from "@/lib/http/fetchJson";
import { UploadedFileRow } from "@/components/rfq/upload/UploadedFileRow";
import {
  canRunStoredFileAnalysis,
  isWorkbookRfqUpload,
  STORED_NAME_DB_ONLY,
  type AnalysisStatusEvent,
  type FullAnalyzeOk,
  type PipelineState,
  type UploadedPackageFile,
} from "@/components/rfq/upload/uploadTypes";

export {
  STORED_NAME_DB_ONLY,
  type AnalysisStatusEvent,
  type AnalysisStatusKind,
  type FullAnalyzeOk,
  type UploadedPackageFile,
} from "@/components/rfq/upload/uploadTypes";
import { errorMessage } from "@/lib/core/errors";


const DEMO_SAMPLE_WORKBOOKS = [
  { file: "RFQ-STMP-CLP-001.xlsx", label: "Stamping clip" },
  { file: "RFQ-MACH-BRK-001.xlsx", label: "Machining bracket" },
  { file: "RFQ-SEAT-NEW-002.xlsx", label: "Seat assembly" },
  { file: "RFQ-ELEC-PCB-001.xlsx", label: "Electronics PCB" },
  { file: "RFQ-INJ-HOU-001.xlsx", label: "Injection housing" },
] as const;

type RfqPackageUploadProps = {
  /** Compact card for Analysis canvas — hides inline result dumps (use Overview / Matching tabs). */
  embedded?: boolean;
  onUploaded?: (file: UploadedPackageFile) => void;
  onAnalyzed?: (file: UploadedPackageFile, analysis: FullAnalyzeOk) => void | Promise<void>;
  onAnalysisStatusChange?: (event: AnalysisStatusEvent) => void;
};

export function RfqPackageUpload({
  embedded = false,
  onUploaded,
  onAnalyzed,
  onAnalysisStatusChange,
}: RfqPackageUploadProps) {
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
      const data = await fetchJson<FullAnalyzeOk>(
        endpoint,
        "Analysis failed",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storedName: f.storedName,
            uploadId: f.id,
            originalName: f.originalName,
          }),
        },
      );
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
      const message = errorMessage(e, "Analysis failed");
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
        setError(errorMessage(e, "Upload failed"));
      } finally {
        setBusy(false);
      }
    },
    [uploadOne, onUploaded, runPackageAnalysis, onAnalysisStatusChange],
  );

  return (
    <Card
      className={[
        "bg-card/45 border-border",
        embedded ? "border-[var(--ra-border)] shadow-sm" : "border-dashed",
      ].join(" ")}
    >
      <CardHeader className={embedded ? "p-4 pb-2" : "p-5 pb-3"}>
        <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase flex items-center gap-2">
          <Upload className="size-3.5 opacity-80" aria-hidden />
          {embedded ? "Upload workbook for analysis" : "Upload package file"}
        </CardTitle>
      </CardHeader>
      <CardContent className={embedded ? "p-4 pt-0 space-y-3" : "p-5 pt-0 space-y-3"}>
        {embedded ? (
          <div className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">Demo samples:</span>{" "}
            {DEMO_SAMPLE_WORKBOOKS.map((s, i) => (
              <span key={s.file}>
                {i > 0 ? " · " : null}
                <a
                  href={`/samples/workbooks/${s.file}`}
                  download
                  className="text-accent hover:underline underline-offset-2"
                >
                  {s.label}
                </a>
              </span>
            ))}
          </div>
        ) : null}

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
            {busy ? "Uploading…" : embedded ? "Choose workbook" : "Choose files"}
          </Button>
        </div>

        {error ? (
          <div className="text-[12px] text-red-600 dark:text-red-300" role="alert">
            {error}
          </div>
        ) : null}

        {items.length > 0 ? (
          <ul className="text-[12px] space-y-4 border border-border rounded-lg p-3 bg-muted/20">
            {items.map((f) => (
              <UploadedFileRow
                key={f.id}
                f={f}
                ps={pdfPipeline[f.id] ?? { status: "idle" as const }}
                busy={busy}
                embedded={embedded}
                onAnalyze={runPackageAnalysis}
              />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
