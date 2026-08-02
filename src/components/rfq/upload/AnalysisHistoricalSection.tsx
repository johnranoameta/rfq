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
import type { FullAnalyzeOk } from "@/components/rfq/upload/uploadTypes";

/** Ranked historical matches, overall and per line item. */
export function AnalysisHistoricalSection({ data: ps_data }: { data: FullAnalyzeOk }) {
  const ps = { data: ps_data } as const;
  return (
    <>
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
    </>
  );
}
