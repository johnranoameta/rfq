"use client";

import type { ItemRow } from "@/lib/rfq/referenceMatchScoring";
import {
  bandClasses,
  bandLabel,
  displayRfqIdLocal,
  referenceScoreBand,
} from "@/lib/rfq/referenceMatchScoring";

type MatchRow = ItemRow["matches"][number];

/** Collapsible list of the runner-up historical matches for one line item. */
export function AlternativeReferences({ alts }: { alts: MatchRow[] }) {
  if (alts.length === 0) return null;
  return (
          <details className="group">
            <summary className="cursor-pointer text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <span className="group-open:hidden">▸</span>
              <span className="hidden group-open:inline">▾</span>
              Alternative references ({alts.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {alts.map((m) => {
                const altScore01 = m.similarity_0_1 ?? m.score / 100;
                const altBand = referenceScoreBand(altScore01);
                return (
                  <div
                    key={m.project_id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/20 px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {displayRfqIdLocal(m.project_id)}
                      </div>
                      <div
                        className="text-[11px] truncate"
                        title={`${m.record.rfq.part_name} · ${m.record.rfq.material}`}
                      >
                        {m.record.rfq.part_name} · {m.record.rfq.material}
                      </div>
                    </div>
                    <span
                      className={[
                        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase",
                        bandClasses(altBand),
                      ].join(" ")}
                    >
                      {Math.round(altScore01 * 100)}% · {bandLabel(altBand)}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>
  );
}
