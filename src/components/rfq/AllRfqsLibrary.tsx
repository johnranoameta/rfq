"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

type UploadAnalysisSummary = {
  session_id: string;
  upload_id: string;
  original_filename: string;
  stored_filename: string;
  customer_name: string | null;
  program_name: string | null;
  part_number: string | null;
  rfq_reference: string | null;
  risk_score: number | null;
  line_item_count: number;
  created_at: string;
};

type SeedProjectRow = {
  rfq_id: number;
  customer_id: number;
  customer_name: string;
  program_name: string;
  part_name: string;
  part_number: string;
  process_family: string;
  material_grade: string | null;
  annual_volume: number | null;
  sop_date: string | null;
  rfq_case_code: string | null;
  created_at: string | null;
};

type CatalogResponse = {
  upload_analyses: UploadAnalysisSummary[];
  historical_uploads: Array<{
    session_id: string;
    project_id: string;
    original_filename: string;
    source: string;
    customer: string;
    program: string;
    part_number: string;
    created_at: string;
  }>;
  seed_projects: SeedProjectRow[];
  error?: string;
};

type SessionDetail = CatalogResponse["upload_analyses"][number] & {
  parse: { parsed: Record<string, unknown>; mode: string; model: string };
  gap: { summary: string; risk_score: number; completeness_status: string };
};

export function AllRfqsLibrary() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [histUploadBusy, setHistUploadBusy] = useState(false);
  const [histUploadError, setHistUploadError] = useState<string | null>(null);
  const [histDeletingProjectId, setHistDeletingProjectId] = useState<string | null>(null);

  function displayRfqId(id: string): string {
    const m = id.match(/^H(\d+)$/i);
    if (!m) return id;
    return `RFQ-SEAT-HIST-${m[1]!.padStart(3, "0")}`;
  }

  function uploadMatchId(u: UploadAnalysisSummary): string {
    const ref = (u.rfq_reference ?? "").trim();
    if (ref) return ref;
    return `U-${u.session_id.replace(/-/g, "").slice(0, 12)}`;
  }

  function seedMatchId(rfqId: number): string {
    return displayRfqId(`H${String(rfqId).padStart(3, "0")}`);
  }

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/rfq/database/catalog", { cache: "no-store" });
      const json = (await res.json()) as CatalogResponse;
      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setData(json);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load catalog");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  async function deletePersistedSession(sessionId: string, label: string) {
    if (
      !window.confirm(
        `Delete saved analysis for “${label}”? This removes the row from the database (upload files on disk are not deleted).`,
      )
    ) {
      return;
    }
    setDeletingId(sessionId);
    try {
      const res = await fetch(`/api/rfq/database/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Delete failed (${res.status})`);
      }
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
      await loadCatalog();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function uploadHistoricalFile(file: File) {
    setHistUploadError(null);
    setHistUploadBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/rfq/database/historical", {
        method: "POST",
        body,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; inserted?: number };
      if (!res.ok) {
        throw new Error(json.error || `Upload failed (${res.status})`);
      }
      await loadCatalog();
    } catch (e) {
      setHistUploadError(e instanceof Error ? e.message : "Historical upload failed");
    } finally {
      setHistUploadBusy(false);
    }
  }

  async function deleteHistoricalProject(projectId: string) {
    if (!window.confirm(`Delete historical record "${projectId}"?`)) return;
    setHistDeletingProjectId(projectId);
    try {
      const res = await fetch(`/api/rfq/database/historical/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Delete failed (${res.status})`);
      }
      await loadCatalog();
    } catch (e) {
      setHistUploadError(e instanceof Error ? e.message : "Historical delete failed");
    } finally {
      setHistDeletingProjectId(null);
    }
  }

  useEffect(() => {
    if (!selectedSessionId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void fetch(`/api/rfq/database/sessions/${encodeURIComponent(selectedSessionId)}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as SessionDetail & { error?: string };
        if (!res.ok) throw new Error(json.error || `Not found (${res.status})`);
        if (!cancelled) setDetail(json);
      })
      .catch((e) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(e instanceof Error ? e.message : "Detail load failed");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground font-mono py-12 text-center">Loading RFQ database…</div>
    );
  }

  if (loadError && !data) {
    return (
      <Card className="border-destructive/40 bg-destructive/5 max-w-lg">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm text-destructive">Database unavailable</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3 text-sm text-muted-foreground">
          <p>{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadCatalog()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const uploads = data?.upload_analyses ?? [];
  const historicalUploads = data?.historical_uploads ?? [];
  const seeds = data?.seed_projects ?? [];
  const q = search.trim().toLowerCase();
  const filteredUploads =
    q.length === 0
      ? uploads
      : uploads.filter((u) => {
          const tokens = [
            u.session_id,
            uploadMatchId(u),
            u.upload_id,
            u.original_filename,
            u.customer_name ?? "",
            u.program_name ?? "",
            u.part_number ?? "",
            u.rfq_reference ?? "",
          ];
          return tokens.some((t) => t.toLowerCase().includes(q));
        });
  const filteredSeeds =
    q.length === 0
      ? seeds
      : seeds.filter((s) => {
          const tokens = [
            String(s.rfq_id),
            seedMatchId(s.rfq_id),
            s.customer_name,
            s.program_name,
            s.part_name,
            s.part_number,
            s.process_family,
            s.rfq_case_code ?? "",
          ];
          return tokens.some((t) => t.toLowerCase().includes(q));
        });
  const filteredHistoricalUploads =
    q.length === 0
      ? historicalUploads
      : historicalUploads.filter((h) => {
          const tokens = [h.project_id, h.original_filename, h.customer, h.program, h.part_number, h.source];
          return tokens.some((t) => t.toLowerCase().includes(q));
        });

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">All RFQs</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID (U-/H-), file, part, program"
            className="h-8 w-[320px] rounded-md border border-border bg-background px-2 text-[12px]"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => void loadCatalog()}>
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card/50">
        <CardHeader className="p-4 pb-2 border-b border-border">
          <CardTitle className="text-[12px] uppercase tracking-wide font-semibold text-muted-foreground">
            Uploaded & analyzed (persisted)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredUploads.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {uploads.length === 0
                ? "No persisted analyses yet. Upload a 4-tab workbook (.xlsx/.xls) and wait for parse + gap analysis to finish."
                : "No uploaded analyses match your search."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase">Match ID</TableHead>
                  <TableHead className="text-[11px] uppercase">File</TableHead>
                  <TableHead className="text-[11px] uppercase">Customer / program</TableHead>
                  <TableHead className="text-[11px] uppercase">Part</TableHead>
                  <TableHead className="text-[11px] uppercase">Lines</TableHead>
                  <TableHead className="text-[11px] uppercase">Risk</TableHead>
                  <TableHead className="text-[11px] uppercase">Saved</TableHead>
                  <TableHead className="text-[11px] uppercase w-[100px]">Detail</TableHead>
                  <TableHead className="text-[11px] uppercase w-[52px]" aria-label="Delete" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUploads.map((u) => (
                  <TableRow key={u.session_id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-[11px]">{uploadMatchId(u)}</TableCell>
                    <TableCell className="font-mono text-[11px] max-w-[200px] truncate" title={u.original_filename}>
                      {u.original_filename}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {[u.customer_name, u.program_name].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">{u.part_number || "—"}</TableCell>
                    <TableCell className="font-mono text-[11px]">{u.line_item_count}</TableCell>
                    <TableCell>
                      {u.risk_score != null ? (
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {u.risk_score}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                      {u.created_at}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[11px]"
                        onClick={() =>
                          setSelectedSessionId((cur) => (cur === u.session_id ? null : u.session_id))
                        }
                      >
                        {selectedSessionId === u.session_id ? "Hide" : "View"}
                      </Button>
                    </TableCell>
                    <TableCell className="p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === u.session_id}
                        aria-label={`Delete ${u.original_filename}`}
                        onClick={() => void deletePersistedSession(u.session_id, u.original_filename)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card/50">
        <CardHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-[12px] uppercase tracking-wide font-semibold text-muted-foreground">
              Historical uploads (managed)
            </CardTitle>
            <label className="inline-flex items-center gap-2">
              <input
                type="file"
                className="sr-only"
                accept=".jsonl,.json,application/json,text/plain"
                disabled={histUploadBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadHistoricalFile(f);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={histUploadBusy}
                onClick={(e) => {
                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement | null);
                  input?.click();
                }}
              >
                {histUploadBusy ? "Uploading…" : "Upload historical (.jsonl/.json)"}
              </Button>
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {histUploadError ? (
            <div className="p-3 text-[12px] text-destructive border-b border-border">{histUploadError}</div>
          ) : null}
          {filteredHistoricalUploads.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {historicalUploads.length === 0
                ? "No managed historical uploads yet."
                : "No historical uploads match your search."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase">RFQ ID</TableHead>
                  <TableHead className="text-[11px] uppercase">Customer / program</TableHead>
                  <TableHead className="text-[11px] uppercase">Part</TableHead>
                  <TableHead className="text-[11px] uppercase">Source file</TableHead>
                  <TableHead className="text-[11px] uppercase">Saved</TableHead>
                  <TableHead className="text-[11px] uppercase w-[52px]" aria-label="Delete" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistoricalUploads.map((h) => (
                  <TableRow key={h.session_id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-[11px]">{h.project_id}</TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {[h.customer, h.program].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">{h.part_number || "—"}</TableCell>
                    <TableCell className="font-mono text-[11px] max-w-[220px] truncate" title={h.original_filename}>
                      {h.original_filename}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">{h.created_at}</TableCell>
                    <TableCell className="p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={histDeletingProjectId === h.project_id}
                        aria-label={`Delete historical ${h.project_id}`}
                        onClick={() => void deleteHistoricalProject(h.project_id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedSessionId ? (
        <Card className="border-border bg-card/40">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-[12px] font-semibold">Parse snapshot</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-sm">
            {detailLoading ? (
              <p className="text-muted-foreground font-mono text-[12px]">Loading…</p>
            ) : detailError ? (
              <p className="text-[12px] text-destructive">{detailError}</p>
            ) : detail ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <span className="text-muted-foreground">Model</span>
                    <div className="font-mono">{detail.parse.model}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mode</span>
                    <div className="font-mono">{detail.parse.mode}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Gap summary
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{detail.gap.summary}</p>
                </div>
                <details className="rounded-lg border border-border bg-background/30">
                  <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold font-mono">
                    Parsed JSON (excerpt)
                  </summary>
                  <pre className="p-3 pt-0 text-[10px] font-mono overflow-x-auto max-h-[320px] overflow-y-auto text-muted-foreground">
                    {JSON.stringify(detail.parse.parsed, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <p className="text-muted-foreground text-[12px]">Could not load detail.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border bg-card/50">
        <CardHeader className="p-4 pb-2 border-b border-border">
          <CardTitle className="text-[12px] uppercase tracking-wide font-semibold text-muted-foreground">
            Historical seed projects ({filteredSeeds.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {filteredSeeds.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {seeds.length === 0 ? "No seed rows (database not initialized)." : "No seed projects match your search."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase">Match ID</TableHead>
                  <TableHead className="text-[11px] uppercase">ID</TableHead>
                  <TableHead className="text-[11px] uppercase">Customer</TableHead>
                  <TableHead className="text-[11px] uppercase">Program</TableHead>
                  <TableHead className="text-[11px] uppercase">Part</TableHead>
                  <TableHead className="text-[11px] uppercase">PN</TableHead>
                  <TableHead className="text-[11px] uppercase">Process</TableHead>
                  <TableHead className="text-[11px] uppercase">Vol</TableHead>
                  <TableHead className="text-[11px] uppercase">Case</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSeeds.map((s) => (
                  <TableRow key={s.rfq_id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-[11px]">{seedMatchId(s.rfq_id)}</TableCell>
                    <TableCell className="font-mono text-[11px]">{s.rfq_id}</TableCell>
                    <TableCell className="text-[12px]">{s.customer_name}</TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">{s.program_name}</TableCell>
                    <TableCell className="text-[12px] max-w-[180px] truncate" title={s.part_name}>
                      {s.part_name}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-accent dark:text-accent/90">{s.part_number}</TableCell>
                    <TableCell className="text-[11px]">{s.process_family}</TableCell>
                    <TableCell className="font-mono text-[11px]">
                      {s.annual_volume != null ? s.annual_volume.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">{s.rfq_case_code || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
