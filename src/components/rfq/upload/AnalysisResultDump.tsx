"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParsedHeaderCard } from "@/components/rfq/upload/ParsedHeaderCard";
import { AnalysisGapSection } from "@/components/rfq/upload/AnalysisGapSection";
import type { FullAnalyzeOk } from "@/components/rfq/upload/uploadTypes";

export type AnalysisResultDumpProps = {
  data: FullAnalyzeOk;
  isWorkbook: boolean;
  parsed: Record<string, unknown> | null;
  wh: Record<string, unknown> | undefined;
};

/**
 * The full parsed-analysis readout shown under a file in non-embedded mode:
 * workbook header, line items, technical specs, gap summary and the raw JSON.
 */
export function AnalysisResultDump({ data: ps_data, isWorkbook, parsed, wh }: AnalysisResultDumpProps) {
  const ps = { data: ps_data } as const;
  return (
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

    <ParsedHeaderCard isWorkbook={isWorkbook} parsed={parsed} wh={wh} />

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

    <AnalysisGapSection data={ps.data} />

    <details className="text-[10px] font-mono">
      <summary className="cursor-pointer text-muted-foreground">Raw parsed JSON</summary>
      <pre className="mt-2 p-2 rounded border border-border bg-background/40 overflow-x-auto max-h-[180px] overflow-y-auto whitespace-pre-wrap break-words">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    </details>
  </div>
  );
}
