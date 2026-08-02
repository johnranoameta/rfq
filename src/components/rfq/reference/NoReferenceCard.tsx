"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ItemRow } from "@/lib/rfq/referenceMatchScoring";

/** Shown for a line item the match engine found nothing for. */
export function NoReferenceCard({ row }: { row: ItemRow }) {
  return (
    <Card className="bg-card/40 border-border">
      <CardContent className="p-5 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] text-muted-foreground">{row.item_label}</div>
            <div className="text-sm font-semibold mt-0.5">{row.part_name || "—"}</div>
          </div>
          <Badge
            variant="outline"
            className="border-border text-muted-foreground text-[10px] font-mono uppercase"
          >
            No reference
          </Badge>
        </div>
        <p className="text-[12px] text-muted-foreground">
          No historical RFQ matched. Treat this line as a new quote.
        </p>
      </CardContent>
    </Card>
  );
}
