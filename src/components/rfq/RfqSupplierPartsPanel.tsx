"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
import { EXTERNAL_SUPPLIER_ID } from "@/lib/rfq/externalPriceFetcher";
import type { CostSelectionResult } from "@/lib/rfq/costLookupTypes";
import type { SupplierPartRow } from "@/lib/rfq/costLookupTypes";

function isExternalSource(row: SupplierPartRow): boolean {
  return row.supplier_id === EXTERNAL_SUPPLIER_ID;
}

function fmtCost(row: SupplierPartRow): string {
  if (row.unit_cost != null) return `${row.currency} ${row.unit_cost.toFixed(4)}`;
  if (row.price_breaks_json) {
    try {
      const tiers = JSON.parse(row.price_breaks_json) as { min_qty: number; unit_cost: number }[];
      if (tiers.length > 0) {
        const lo = Math.min(...tiers.map((t) => t.unit_cost));
        return `${row.currency} ${lo.toFixed(4)}+ (tiered)`;
      }
    } catch {
      // ignore malformed JSON, fall through
    }
  }
  return "—";
}

function selectedSourceLabel(r: CostSelectionResult): string {
  if (r.selected === "external") return r.externalSourceLabel || "External";
  if (r.selected === "internal") return "Internal";
  return "—";
}

export function RfqSupplierPartsPanel() {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<SupplierPartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const [partNumber, setPartNumber] = useState("");
  const [quantity, setQuantity] = useState("1000");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<CostSelectionResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rfq/supplier-parts", { cache: "no-store" });
      const json = (await res.json()) as { rows?: SupplierPartRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setRows(json.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load supplier parts");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadBusy(true);
      setUploadMessage(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/rfq/supplier-parts/upload", { method: "POST", body: formData });
        const json = (await res.json()) as { imported?: number; skipped?: number; error?: string };
        if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
        setUploadMessage(
          `Imported ${json.imported ?? 0} row(s)${json.skipped ? `, skipped ${json.skipped} malformed row(s)` : ""}.`,
        );
        await load();
      } catch (e) {
        setUploadMessage(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploadBusy(false);
      }
    },
    [load],
  );

  const handleLookup = useCallback(async () => {
    const pn = partNumber.trim();
    const qty = Number(quantity);
    if (!pn) {
      setLookupError("Enter a part number.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setLookupError("Quantity must be a positive number.");
      return;
    }
    setLookupBusy(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await fetch(
        `/api/rfq/cost-lookup?partNumber=${encodeURIComponent(pn)}&quantity=${encodeURIComponent(String(qty))}`,
      );
      const json = (await res.json()) as CostSelectionResult & { error?: string };
      if (!res.ok) throw new Error(json.error || `Lookup failed (${res.status})`);
      setLookupResult(json);
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLookupBusy(false);
    }
  }, [partNumber, quantity]);

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 border-border">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Supplier &amp; Part DB
              </CardTitle>
              <div className="mt-1 text-[12px] text-muted-foreground">
                Shared master data — internal supplier quotes and cached external distributor pricing (via the
                TrustedParts.com API — see <code>scripts/refresh-trustedparts-price.mjs</code>), referenced by the
                dual-source cost lookup.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                disabled={uploadBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleUpload(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadBusy ? "Uploading…" : "Upload workbook"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-3">
          {uploadMessage ? (
            <div className="rounded-lg border border-border/70 bg-background/20 px-3 py-2 text-[12px] text-muted-foreground">
              {uploadMessage}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {error}
            </div>
          ) : null}
          {loading ? (
            <div className="text-[12px] text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">
              No supplier/part data yet. Run <code>npm run sample-supplier-parts</code> to generate a sample workbook
              under <code>project_files/sample-supplier-parts.xlsx</code>, then upload it above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Quote / Fetched</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-[12px]">{r.part_number}</TableCell>
                    <TableCell>
                      {isExternalSource(r) ? (
                        <Badge variant="outline" className="border-violet-400/40 text-violet-700 dark:text-violet-200">
                          {r.source}
                        </Badge>
                      ) : (
                        <span className="font-mono text-[12px]">{r.supplier_id}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">{r.source}</TableCell>
                    <TableCell className="font-mono text-[12px]">{fmtCost(r)}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {r.quote_date || r.fetched_at || "—"}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">{r.approval_status || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Cost Lookup
          </CardTitle>
          <div className="mt-1 text-[12px] text-muted-foreground">
            Compare internal vs. external distributor pricing at a given quantity for a part above.
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                Part number
              </span>
              <input
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="ABC-123"
                className="h-9 w-[200px] rounded-lg border border-border bg-background/20 px-3 text-[12px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Quantity</span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 w-[120px] rounded-lg border border-border bg-background/20 px-3 text-[12px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
              />
            </div>
            <Button type="button" size="sm" disabled={lookupBusy} onClick={() => void handleLookup()}>
              {lookupBusy ? "Looking up…" : "Look up"}
            </Button>
          </div>

          {lookupError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {lookupError}
            </div>
          ) : null}

          {lookupResult ? (
            <div
              className={[
                "rounded-xl border p-4 space-y-2",
                lookupResult.riskFlag
                  ? "border-orange-500/40 bg-orange-500/10"
                  : lookupResult.status === "compared"
                    ? "border-emerald-400/40 bg-emerald-400/10"
                    : "border-border/70 bg-background/15",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{selectedSourceLabel(lookupResult)}</Badge>
                {lookupResult.riskFlag ? (
                  <Badge className="border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-200" variant="outline">
                    Risk: sources disagree
                  </Badge>
                ) : null}
                {lookupResult.externalStale ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {lookupResult.externalSourceLabel || "External"} data stale
                  </Badge>
                ) : null}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-background/20 p-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground mb-1">
                    Internal
                  </div>
                  <div className="font-mono text-[13px]">
                    {lookupResult.internal
                      ? `${lookupResult.internal.currency} ${lookupResult.internal.unitCost.toFixed(4)} (tier ${lookupResult.internal.tierMinQty}+)`
                      : "no data"}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background/20 p-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground mb-1">
                    {lookupResult.externalSourceLabel || "External"}
                  </div>
                  <div className="font-mono text-[13px]">
                    {lookupResult.external
                      ? `${lookupResult.external.currency} ${lookupResult.external.unitCost.toFixed(4)} (tier ${lookupResult.external.tierMinQty}+)`
                      : "no data"}
                  </div>
                </div>
              </div>
              <div className="text-[12.5px] text-muted-foreground leading-relaxed">{lookupResult.explanation}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
