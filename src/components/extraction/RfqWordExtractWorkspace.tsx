"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RefreshCw, Trash2, Upload } from "lucide-react";
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

export type ExtractPackageSummary = {
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

type UploadedWordFile = {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  storedName: string;
};

type ContentIndexRow = {
  id?: string;
  source_kind?: string;
  filename?: string;
  section_display?: string | null;
  section_number?: string | null;
  raw_text?: string;
};

type SectionRow = {
  number: string;
  title: string;
  display: string;
};

type BrowsePayload = {
  sections?: SectionRow[];
  content_index?: ContentIndexRow[];
  section_content?: { section_number?: string; raw_text?: string }[];
  error?: string | null;
};

export type RfqWordExtractWorkspaceProps = {
  embedded?: boolean;
  selectedKey?: string | null;
  onSelectedKeyChange?: (key: string | null) => void;
  onPackagesChange?: (packages: ExtractPackageSummary[]) => void;
  onExtractionComplete?: (key: string | null) => void;
  onPackageDeleted?: () => void;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function RfqWordExtractWorkspace({
  embedded = false,
  selectedKey: selectedKeyProp,
  onSelectedKeyChange,
  onPackagesChange,
  onExtractionComplete,
  onPackageDeleted,
}: RfqWordExtractWorkspaceProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<UploadedWordFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearFirst, setClearFirst] = useState(false);
  const [loadDb, setLoadDb] = useState(true);
  const [doNormalize, setDoNormalize] = useState(true);

  const [packages, setPackages] = useState<ExtractPackageSummary[]>([]);
  const [selectedKeyInternal, setSelectedKeyInternal] = useState<string | null>(null);
  const [browse, setBrowse] = useState<BrowsePayload | null>(null);
  const [normalized, setNormalized] = useState<NormalizedPackage | null>(null);
  const [view, setView] = useState<"clean" | "sections" | "overview">("clean");

  const selectedKey = selectedKeyProp !== undefined ? selectedKeyProp : selectedKeyInternal;

  const setSelectedKey = useCallback(
    (key: string | null) => {
      if (onSelectedKeyChange) onSelectedKeyChange(key);
      else setSelectedKeyInternal(key);
    },
    [onSelectedKeyChange],
  );

  const loadPackageList = useCallback(async () => {
    const res = await fetch("/api/extraction/manifest");
    if (!res.ok) return [];
    const data = (await res.json()) as { packages: ExtractPackageSummary[] };
    const list = data.packages ?? [];
    setPackages(list);
    onPackagesChange?.(list);
    return list;
  }, [onPackagesChange]);

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
      setMessage(`Uploaded ${file.name}. Click Run extraction to parse the package.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteSelectedPackage() {
    if (!selectedKey) return;
    const pkg = packages.find((p) => p.key === selectedKey);
    const label = pkg?.filename ?? selectedKey;
    if (!window.confirm(`Remove “${label}” and delete its extracted data?`)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/extraction/package?package=${encodeURIComponent(selectedKey)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string; packages?: ExtractPackageSummary[] };
      if (!res.ok) throw new Error(data.error || `Delete failed (${res.status})`);
      const list = data.packages ?? [];
      setPackages(list);
      onPackagesChange?.(list);
      const nextKey = list[0]?.key ?? null;
      setSelectedKey(nextKey);
      setMessage(list.length ? "Package removed." : "All packages removed.");
      onPackageDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function runExtraction() {
    if (!pending) {
      setError("Choose a Word RFQ package (.doc or .docx) first");
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
      const summary = data.summary as ExtractPackageSummary | undefined;
      setMessage(
        `Extraction complete: ${summary?.filename ?? pending.originalName}. You can upload another RFQ.`,
      );
      setPending(null);
      const list = await loadPackageList();
      const key = summary?.key ?? list[0]?.key ?? null;
      if (key) setSelectedKey(key);
      onExtractionComplete?.(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  const sections = browse?.sections ?? [];
  const content = browse?.content_index ?? [];

  return (
    <div className={embedded ? "ra-canvas-content space-y-4" : "flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full space-y-4"}>
      <Card className="border-[var(--ra-border)] bg-[var(--ra-card)] shadow-[var(--ra-shadow)]">
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-base font-semibold text-[var(--ra-text)]">
            Upload Word RFQ package
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4 text-sm text-[var(--ra-mid)]">
          <p>
            Upload a GM-style Word RFQ (<strong>.doc</strong> or <strong>.docx</strong>) with embedded drawings,
            specs, and attachments. Each extraction is kept in the sidebar — upload additional RFQs anytime without
            clearing prior results. Use the trash icon in the sidebar to remove a package.
          </p>
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
            <Button
              type="button"
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
          {pending ? (
            <p className="text-xs text-[var(--ra-muted)] font-mono">
              Ready: {pending.originalName} ({formatBytes(pending.size)})
            </p>
          ) : null}
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2" title="Wipe all extracted RFQs before this run">
              <input type="checkbox" checked={clearFirst} onChange={(e) => setClearFirst(e.target.checked)} />
              Replace all existing RFQs (clear output first)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={loadDb} onChange={(e) => setLoadDb(e.target.checked)} />
              Load rfq.db
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={doNormalize} onChange={(e) => setDoNormalize(e.target.checked)} />
              Normalize (required for Inquiry)
            </label>
          </div>
        </CardContent>
      </Card>

      {message ? (
        <p className="text-sm text-[var(--ra-mid)] border border-[var(--ra-border)] rounded-md px-3 py-2 bg-[var(--ra-card)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      {packages.length > 0 ? (
        <Card className="border-[var(--ra-border)] bg-[var(--ra-card)] shadow-[var(--ra-shadow)]">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base font-semibold text-[var(--ra-text)]">Extracted packages</CardTitle>
            {selectedKey ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="shrink-0 text-red-700 border-red-300 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                onClick={() => void deleteSelectedPackage()}
              >
                <Trash2 className="size-3.5 mr-1" aria-hidden />
                Delete
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {!embedded && packages.length > 1 ? (
              <select
                className="w-full max-w-md text-sm border border-[var(--ra-border)] rounded-md px-2 py-1.5 bg-[var(--ra-bg)]"
                value={selectedKey ?? ""}
                onChange={(e) => setSelectedKey(e.target.value || null)}
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
            ) : null}

            {browse?.error ? <p className="text-sm text-red-700 dark:text-red-300">{String(browse.error)}</p> : null}

            {!selectedKey ? (
              <p className="text-sm text-[var(--ra-muted)]">
                Select a package from the sidebar (Training) to view extracted fields.
              </p>
            ) : null}

            {selectedKey && !normalized && view === "clean" ? (
              <p className="text-sm text-[var(--ra-muted)]">
                No normalized data yet. Re-run extraction with <strong>Normalize</strong> checked.
              </p>
            ) : null}

            {selectedKey && (view === "clean" ? normalized : browse) ? (
              <>
                <div className="flex flex-wrap gap-3 text-xs">
                  <button
                    type="button"
                    className={view === "clean" ? "font-semibold underline text-[var(--ra-text)]" : "text-[var(--ra-muted)]"}
                    onClick={() => setView("clean")}
                  >
                    Section fields
                  </button>
                  <button
                    type="button"
                    className={view === "sections" ? "font-semibold underline text-[var(--ra-text)]" : "text-[var(--ra-muted)]"}
                    onClick={() => setView("sections")}
                  >
                    Raw by section
                  </button>
                  <button
                    type="button"
                    className={view === "overview" ? "font-semibold underline text-[var(--ra-text)]" : "text-[var(--ra-muted)]"}
                    onClick={() => setView("overview")}
                  >
                    Raw overview
                  </button>
                </div>

                {view === "clean" && normalized ? <NormalizedCleanView pkg={normalized} /> : null}

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
                        <details key={num} className="border border-[var(--ra-border)] rounded-md px-3 py-2">
                          <summary className="text-sm cursor-pointer font-medium">
                            {sec.display} ({atts.length} files)
                          </summary>
                          {body?.raw_text?.trim() ? (
                            <pre className="mt-2 text-[11px] whitespace-pre-wrap max-h-48 overflow-auto bg-[var(--ra-bg)] p-2 rounded">
                              {body.raw_text.slice(0, 8000)}
                            </pre>
                          ) : null}
                          {atts.map((item, idx) => (
                            <div key={item.id ?? idx} className="mt-3 border-t border-[var(--ra-border)] pt-2">
                              <p className="text-xs font-mono font-semibold">{item.filename}</p>
                              <pre className="text-[11px] whitespace-pre-wrap max-h-64 overflow-auto mt-1 text-[var(--ra-muted)]">
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
        <p className="text-sm text-[var(--ra-muted)] px-1">
          No extracted packages yet. Upload a Word RFQ and run extraction (Windows Server with Microsoft Word required).
        </p>
      )}
    </div>
  );
}
