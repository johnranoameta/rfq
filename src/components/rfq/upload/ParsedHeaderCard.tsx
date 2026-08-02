"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ParsedHeaderCardProps = {
  isWorkbook: boolean;
  parsed: Record<string, unknown> | null;
  wh: Record<string, unknown> | undefined;
};

/** Header / commercial fields of a parsed RFQ, workbook or document. */
export function ParsedHeaderCard({ isWorkbook, parsed, wh }: ParsedHeaderCardProps) {
  return (
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
  );
}
