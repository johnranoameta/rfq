"use client";

import { useId, useMemo, useRef } from "react";
import { useBomParts } from "@/lib/rfq/useBomParts";

export function RfqWorkbookBomPanel({ fileId }: { fileId: string }) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { rows, loading, error, uploadBusy, uploadMessage, upload } = useBomParts(fileId);

  const stats = useMemo(() => {
    const total = rows.length;
    const withMpn = rows.filter((r) => r.mfr_part_number).length;
    const unresolved = rows.filter((r) => !r.mfr_part_number);
    const missingCost = rows.filter((r) => r.unit_cost == null).length;
    const missingQty = rows.filter((r) => r.quantity == null).length;
    const missingDescription = rows.filter((r) => !r.description).length;
    return { total, withMpn, unresolved, missingCost, missingQty, missingDescription };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="ra-summary-box flex items-start justify-between gap-3 flex-wrap">
        <div>
          Ingest a suppliers/parts workbook for this RFQ — see <code>docs/sample_supplier_and_part_data.xlsx</code>{" "}
          for the expected shape. This is a separate upload from the RFQ package itself; the parsed lines here are
          what Costing agent reads (via manufacturer part number) for the dual-source cost lookup.
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
              if (file) void upload(file);
            }}
          />
          <button type="button" className="ra-btn" disabled={uploadBusy} onClick={() => fileInputRef.current?.click()}>
            {uploadBusy ? "Uploading…" : "Upload BOM workbook"}
          </button>
        </div>
      </div>

      {uploadMessage ? <div className="ra-finding ra-finding-info">{uploadMessage}</div> : null}
      {error ? <div className="ra-finding ra-finding-hi">{error}</div> : null}

      {!loading && rows.length === 0 ? (
        <div className="ra-card">
          <div className="ra-card-b text-[12.5px] text-[var(--ra-muted)]">
            No BOM uploaded for this RFQ yet. Upload a suppliers/parts workbook above — a <code>parts</code> sheet
            with ref_designator, description, quantity, unit_cost, and extended_attributes_json (holding
            mfr_part_number when known).
          </div>
        </div>
      ) : (
        <>
          <div className="ra-card">
            <div className="ra-card-h">
              <span className="ra-card-t">BOM Intelligence Agent</span>
              <span className="ra-badge ra-badge-b">
                {stats.total} of {stats.total} lines parsed
              </span>
            </div>
            <div className="ra-card-b">
              <div className="text-[12.5px] text-[var(--ra-mid)] mb-3">
                Ingest → header normalize → extract manufacturer part number → completeness check. Consumed
                directly by Costing agent — no re-extraction downstream.
              </div>
              <div className="ra-kpi-grid">
                <div className="ra-kpi">
                  <div className="ra-kpi-l">Lines Parsed</div>
                  <div className="ra-kpi-v">{stats.total}</div>
                </div>
                <div className="ra-kpi">
                  <div className="ra-kpi-l">Resolved to MPN</div>
                  <div className="ra-kpi-v">
                    {stats.withMpn} / {stats.total}
                  </div>
                  <div className="text-[11px] text-[var(--ra-muted)] mt-1">
                    {stats.total > 0 ? `${Math.round((stats.withMpn / stats.total) * 100)}% costable` : "—"}
                  </div>
                </div>
                <div className="ra-kpi">
                  <div className="ra-kpi-l">Unresolved Refs</div>
                  <div className="ra-kpi-v" style={{ color: stats.unresolved.length > 0 ? "var(--ra-amber)" : undefined }}>
                    {stats.unresolved.length}
                  </div>
                  <div className="text-[11px] text-[var(--ra-muted)] mt-1">
                    {stats.unresolved[0]
                      ? `${stats.unresolved[0].description || stats.unresolved[0].ref_designator} — no manufacturer part number`
                      : "All lines resolved"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ra-card">
            <div className="ra-card-h">
              <span className="ra-card-t">Uploaded BOM</span>
            </div>
            <div className="ra-card-b overflow-x-auto">
              <table className="ra-table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Description</th>
                    <th>Sub-assembly / Program</th>
                    <th>Qty</th>
                    <th>Unit cost (as quoted)</th>
                    <th>Identity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="ra-mono">{i + 1}</td>
                      <td>
                        <div className="font-medium">{r.description || r.ref_designator}</div>
                        <div className="text-[11px] text-[var(--ra-muted)]">as supplied: &ldquo;{r.ref_designator}&rdquo;</div>
                      </td>
                      <td className="text-[var(--ra-mid)]">
                        {r.sub_assembly || "—"}
                        {r.customer_program ? (
                          <div className="text-[11px] text-[var(--ra-muted)]">{r.customer_program}</div>
                        ) : null}
                      </td>
                      <td className="ra-mono">{r.quantity ?? "—"}</td>
                      <td className="ra-mono">
                        {r.unit_cost != null ? `${r.currency} ${r.unit_cost.toFixed(4)}` : "—"}
                      </td>
                      <td>
                        {r.mfr_part_number ? (
                          <span className="ra-badge ra-badge-g">MPN: {r.mfr_part_number}</span>
                        ) : (
                          <span className="ra-badge ra-badge-r">No manufacturer part number</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ra-card">
            <div className="ra-card-h">
              <span className="ra-card-t">Completeness Checks</span>
            </div>
            <div className="ra-card-b">
              {stats.missingQty === 0 && stats.missingDescription === 0 ? (
                <div className="ra-finding ra-finding-info">
                  All {stats.total} lines have a ref designator, description, and quantity populated.
                </div>
              ) : (
                <div className="ra-finding ra-finding-warn">
                  {stats.missingDescription > 0 ? `${stats.missingDescription} line(s) missing a description. ` : ""}
                  {stats.missingQty > 0 ? `${stats.missingQty} line(s) missing a quantity.` : ""}
                </div>
              )}
              {stats.missingCost > 0 ? (
                <div className="ra-finding ra-finding-warn">
                  {stats.missingCost} line(s) have no quoted unit cost in the source file.
                </div>
              ) : null}
              {stats.unresolved.length > 0 ? (
                <div className="ra-finding ra-finding-warn" style={{ marginBottom: 0 }}>
                  {stats.unresolved.length} line(s) have no manufacturer part number — Costing agent cannot compare
                  these against the Supplier &amp; Part DB.
                </div>
              ) : (
                <div className="ra-finding ra-finding-info" style={{ marginBottom: 0 }}>
                  Every line resolved to a manufacturer part number.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
