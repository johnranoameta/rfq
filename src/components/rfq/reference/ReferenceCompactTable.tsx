"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clampDisplayScore } from "@/lib/rfq/gapScoreAdjustment";
import {
  bandClasses,
  bandLabel,
  displayRfqIdLocal,
  matchCoverage01,
  pct,
  referenceScoreBand,
  type ItemRow,
} from "@/lib/rfq/referenceMatchScoring";

/** Dense one-row-per-item view; the alternative to the card list. */
export function ReferenceCompactTable({ rows, adjustment }: { rows: ItemRow[]; adjustment: number }) {
  return (
    <Card className="bg-card/50 border-border overflow-visible">
      <CardContent className="p-0 overflow-x-auto">
        <Table className="text-[11px] min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Top historical</TableHead>
              <TableHead>Matched RFQs</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Coverage</TableHead>
              <TableHead>Band</TableHead>
              <TableHead>Exact P/N</TableHead>
              <TableHead className="text-right">Matches</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const top = row.matches[0];
              const matchedIds = row.matches.slice(0, 3).map((m) => displayRfqIdLocal(m.project_id));
              const score01 = top ? (top.similarity_0_1 ?? top.score / 100) : 0;
              const rawPct = top ? Math.round(score01 * 100) : 0;
              const adjustedPct = top ? clampDisplayScore(rawPct + adjustment) : 0;
              const adjustedBand = top ? referenceScoreBand(adjustedPct / 100) : null;
              const cov = top ? matchCoverage01(top.reasons) : 0;
              return (
                <TableRow key={`${row.item_index}-${row.item_label}`}>
                  <TableCell className="font-mono">{row.item_label}</TableCell>
                  <TableCell
                    className="max-w-[260px] whitespace-normal break-words"
                    title={row.part_name || "—"}
                  >
                    {row.part_name || "—"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {top?.project_id ? displayRfqIdLocal(top.project_id) : "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-[300px] whitespace-normal break-all font-mono"
                    title={matchedIds.join(", ")}
                  >
                    {matchedIds.length > 0 ? matchedIds.join(", ") : "—"}
                  </TableCell>
                  <TableCell
                    className="text-right font-mono"
                    title={top && adjustment > 0 ? `Raw score: ${rawPct}% · +${adjustment} from gap responses` : undefined}
                  >
                    {top ? adjustedPct + "%" : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{top ? pct(cov) : "—"}</TableCell>
                  <TableCell>
                    {adjustedBand ? (
                      <Badge
                        variant="outline"
                        className={["border font-mono text-[10px] uppercase", bandClasses(adjustedBand)].join(" ")}
                      >
                        {bandLabel(adjustedBand)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{top?.exact_part_number ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right font-mono">{row.matches.length}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
