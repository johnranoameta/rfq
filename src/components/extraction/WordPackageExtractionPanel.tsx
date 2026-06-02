"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { FileText, RefreshCw, Trash2, Upload } from "lucide-react";
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
import NormalizedCleanView from "@/components/extraction/NormalizedCleanView";
import type { NormalizedPackage } from "@/lib/extraction/normalizedTypes";
import "@/components/rfq/rfq-assistant.css";

type UploadedWordFile = {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  storedName: string;
};

type PackageSummary = {
  key: string;
  source: string;
  filename: string;
  rfq_number: string | null;
  title: string | null;
  has_error: boolean;
  error: string | null;
  section_count: number;
  content_count: number;
  attachment_count: number;
};

type ContentIndexRow = {
  id?: string;
  source_kind?: string;
  filename?: string;
  content_type?: string | null;
  section_number?: string | null;
  section_display?: string | null;
  raw_text?: string;
  text_source?: string | null;
  binary_path?: string | null;
  provenance?: Record<string, unknown>;
  error?: string | null;
};

type SectionRow = {
  number: string;
  title: string;
  display: string;
  path?: string;
  paragraph_index?: number;
};

type BrowsePayload = {
  sections?: SectionRow[];
  content_index?: ContentIndexRow[];
  section_content?: { section_number?: string; raw_text?: string; text_source?: string }[];
  error?: string | null;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function WordPackageExtractionPanel() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<UploadedWordFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearFirst, setClearFirst] = useState(true);
  const [loadDb, setLoadDb] = useState(true);
  const [doNormalize, setDoNormalize] = useState(true);

  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [browse, setBrowse] = useState<BrowsePayload | null>(null);
  const [normalized, setNormalized] = useState<NormalizedPackage | null>(null);
  const [view, setView] = useState<"clean" | "sections" | "overview">("clean");

  const loadPackageList = useCallback(async () => {
    const res = await fetch("/api/extraction/manifest");
    if (!res.ok) return [];
    const data = (await res.json()) as { packages: PackageSummary[] };
    setPackages(data.packages ?? []);
    return data.packages ?? [];
  }, []);

  const loadBrowse = useCallback(async (key: string) => {
    const res = await fetch(`/api/extraction/browse?package=${encodeURIComponent(key)}`);
    if (!res.ok) {
      setBrowse(null);
      return;
    }
    const data = (await res.json()) as { browse: BrowsePayload };
    setBrowse(data.browse ?? null);
  }, []);

  const loadNormalized = useCallback(async (key: string) => {
    const res = await fetch(`/api/extraction/normalized?package=${encodeURIComponent(key)}`);
    if (!res.ok) {
      setNormalized(null);
      return;
    }
    const data = (await res.json()) as { package: NormalizedPackage };
    setNormalized(data.package ?? null);
  }, []);

  useEffect(() => {
    void loadPackageList();
  }, [loadPackageList]);

  useEffect(() => {
    if (!selectedKey) {
      setBrowse(null);
      setNormalized(null);
      return;
    }
    void loadBrowse(selectedKey);
    void loadNormalized(selectedKey);
  }, [selectedKey, loadBrowse, loadNormalized]);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extraction/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setPending(data as UploadedWordFile);
      setMessage(`Uploaded ${file.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function runExtraction() {
    if (!pending) {
      setError("Upload a .doc or .docx file first");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("Extracting… this may take several minutes (Word COM on Windows).");
    try {
      const res = await fetch("/api/extraction/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storedName: pending.storedName,
          clearFirst,
          loadDb,
          normalize: doNormalize,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.detail ?? "Extraction failed");
      setMessage(`Done: ${data.summary?.filename ?? pending.originalName}`);
      const list = await loadPackageList();
      const lastPkg = (data.packages as PackageSummary[] | undefined)?.slice(-1)[0];
      const key = lastPkg?.key ?? list[0]?.key ?? null;
      if (key) setSelectedKey(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearOutput() {
    if (!confirmClear) {
      setError("Check confirm before clearing");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extraction/clear", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Clear failed");
      setMessage(
        data.removed?.length
          ? `Cleared: ${(data.removed as string[]).join(", ")}`
          : "Output folder was already empty",
      );
      setPackages([]);
      setSelectedKey(null);
      setBrowse(null);
      setNormalized(null);
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  }

  const sections = browse?.sections ?? [];
  const content = browse?.content_index ?? [];

  return (
    <div className="ra-root min-h-screen flex flex-col">
      <header className="ra-topbar border-b border-border px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-primary" aria-hidden />
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Word RFQ extraction</h1>
            <p className="text-[11px] text-muted-foreground font-mono">
              Python engine · Per-section field tables or raw extraction
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/baseline">Baseline object</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Dashboard</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              void loadPackageList();
              if (selectedKey) {
                void loadBrowse(selectedKey);
                void loadNormalized(selectedKey);
              }
            }}
          >
            <RefreshCw className="size-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload &amp; extract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept=".doc,.docx,application/msword"
              className="hidden"
              onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4 mr-1" />
                Choose Word file
              </Button>
              <Button type="button" disabled={busy || !pending} onClick={() => void runExtraction()}>
                Run extraction
              </Button>
            </div>
            {pending ? (
              <p className="text-xs text-muted-foreground font-mono">
                Ready: {pending.originalName} ({formatBytes(pending.size)})
              </p>
            ) : null}
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={clearFirst}
                  onChange={(e) => setClearFirst(e.target.checked)}
                />
                Clear output before extract
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={loadDb} onChange={(e) => setLoadDb(e.target.checked)} />
                Load rfq.db
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={doNormalize}
                  onChange={(e) => setDoNormalize(e.target.checked)}
                />
                Normalize
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="size-4" />
              Clear output &amp; databases
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={confirmClear}
                onChange={(e) => setConfirmClear(e.target.checked)}
              />
              Confirm delete extraction.json, normalized.json, rfq.db, rfq_normalized.db, and package folders
            </label>
            <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void clearOutput()}>
              Clear all
            </Button>
          </CardContent>
        </Card>

        {message ? (
          <p className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2">{message}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive border border-destructive/30 rounded-md px-3 py-2">{error}</p>
        ) : null}

        {packages.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extracted packages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <select
                className="w-full max-w-md text-sm border border-border rounded-md px-2 py-1.5 bg-background"
                value={selectedKey ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setSelectedKey(v);
                }}
              >
                <option value="">— Select package —</option>
                {packages.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.filename}
                    {p.rfq_number ? ` (#${p.rfq_number})` : ""}
                    {p.has_error ? " ⚠" : ""}
                  </option>
                ))}
              </select>

              {browse?.error ? (
                <p className="text-sm text-destructive">{String(browse.error)}</p>
              ) : null}

              {!selectedKey ? (
                <p className="text-sm text-muted-foreground">Select a package to view extracted content.</p>
              ) : null}

              {selectedKey && !normalized && view === "clean" ? (
                <p className="text-sm text-muted-foreground">
                  No normalized data yet. Re-run extraction with <strong>Normalize</strong> checked.
                </p>
              ) : null}

              {selectedKey && (view === "clean" ? normalized : browse) ? (
                <>
              <div className="flex flex-wrap gap-3 text-xs">
                <button
                  type="button"
                  className={view === "clean" ? "font-semibold underline" : "text-muted-foreground"}
                  onClick={() => setView("clean")}
                >
                  Section fields
                </button>
                <button
                  type="button"
                  className={view === "sections" ? "font-semibold underline" : "text-muted-foreground"}
                  onClick={() => setView("sections")}
                >
                  Raw by section
                </button>
                <button
                  type="button"
                  className={view === "overview" ? "font-semibold underline" : "text-muted-foreground"}
                  onClick={() => setView("overview")}
                >
                  Raw overview
                </button>
              </div>

              {view === "clean" && normalized ? (
                <NormalizedCleanView pkg={normalized} />
              ) : null}

              {view === "overview" && browse ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Chars</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {content.map((row, i) => (
                      <TableRow key={row.id ?? i}>
                        <TableCell className="text-xs">{row.section_display ?? "—"}</TableCell>
                        <TableCell className="text-xs">{row.source_kind}</TableCell>
                        <TableCell className="text-xs font-mono">{row.filename}</TableCell>
                        <TableCell className="text-xs">{(row.raw_text ?? "").length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : view === "sections" ? (
                <div className="space-y-2">
                  {sections.map((sec) => {
                    const num = sec.number;
                    const atts = content.filter(
                      (i) => i.section_number === num && i.source_kind !== "section_body",
                    );
                    const body = (browse?.section_content ?? []).find((s) => s.section_number === num);
                    return (
                      <details key={num} className="border border-border rounded-md px-3 py-2">
                        <summary className="text-sm cursor-pointer font-medium">
                          {sec.display} ({atts.length} files)
                        </summary>
                        {body?.raw_text?.trim() ? (
                          <pre className="mt-2 text-[11px] whitespace-pre-wrap max-h-48 overflow-auto bg-muted/30 p-2 rounded">
                            {body.raw_text.slice(0, 8000)}
                          </pre>
                        ) : null}
                        {atts.map((item, idx) => (
                          <div key={item.id ?? idx} className="mt-3 border-t border-border pt-2">
                            <p className="text-xs font-mono font-semibold">{item.filename}</p>
                            <pre className="text-[11px] whitespace-pre-wrap max-h-64 overflow-auto mt-1 text-muted-foreground">
                              {item.raw_text?.trim()
                                ? item.raw_text.slice(0, 12000)
                                : "(no text — see nested extraction or binary)"}
                            </pre>
                          </div>
                        ))}
                      </details>
                    );
                  })}
                </div>
              ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No extraction.json yet. Upload and run extraction.</p>
        )}
      </main>
    </div>
  );
}
