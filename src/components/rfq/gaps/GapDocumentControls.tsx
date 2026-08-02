"use client";

import { Button } from "@/components/ui/button";
import { supplyAcceptForDoc } from "@/components/rfq/gaps/GapStatusUi";
import type { DocEntry, GapFinding } from "@/data/rfqTypes";
import { DOC_GAP_CONF_THRESHOLD } from "@/lib/rfq/reconcileGapsWithDocuments";

export type GapDocumentControlsProps = {
  f: GapFinding;
  supplySlot: string | null;
  supplySlotDoc: DocEntry | undefined;
  supplyLabel: string | null;
  sessionUpload: boolean;
  supplyDocBusySlot: string | null;
  supplyInputBaseId: string;
  onSupplyMissingDoc: (slotName: string, file: File) => void;
  onRemoveSuppliedDoc: (slotName: string, rule: string) => void;
  onFinalizeGapDoc: (slotName: string, rule: string) => void;
};

/**
 * The supplied-file chip plus the Finalize / Remove / Respond controls for one
 * gap's document slot.
 *
 * The hidden `<input type="file">` is clicked via `getElementById` rather than
 * a ref because the id is also what makes each row's input unique.
 */
export function GapDocumentControls({
  f,
  supplySlot,
  supplySlotDoc,
  supplyLabel,
  sessionUpload,
  supplyDocBusySlot,
  supplyInputBaseId,
  onSupplyMissingDoc,
  onRemoveSuppliedDoc,
  onFinalizeGapDoc,
}: GapDocumentControlsProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
    {supplySlotDoc?.supplied_label ? (
      <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/20 px-2 py-1 text-[10px] font-mono text-muted-foreground">
        <span className="text-foreground font-semibold truncate max-w-[120px]" title={supplySlotDoc.supplied_label}>
          {supplySlotDoc.supplied_label}
        </span>
        {supplySlotDoc.conf != null && supplySlotDoc.conf < DOC_GAP_CONF_THRESHOLD ? (
          <span className="text-amber-700 dark:text-amber-300">{(supplySlotDoc.conf * 100).toFixed(0)}%</span>
        ) : supplySlotDoc.finalized ? (
          <span className="text-violet-600 dark:text-violet-300">Finalized</span>
        ) : (
          <span className="text-amber-700 dark:text-amber-300">Not finalized</span>
        )}
      </div>
    ) : null}
    {sessionUpload && !supplySlotDoc?.finalized ? (
      <Button
        type="button"
        variant="default"
        size="sm"
        className="h-7 text-[11px]"
        disabled={supplyDocBusySlot !== null}
        onClick={() => onFinalizeGapDoc(supplySlot!, f.rule)}
      >
        Finalize
      </Button>
    ) : null}
    {sessionUpload ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
        disabled={supplyDocBusySlot !== null}
        onClick={() => onRemoveSuppliedDoc(supplySlot!, f.rule)}
      >
        Remove
      </Button>
    ) : null}
    {supplySlot && supplyLabel ? (
      <>
        <input
          id={`${supplyInputBaseId}-gap-${f.rule.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
          type="file"
          className="sr-only"
          accept={supplyAcceptForDoc(supplySlotDoc)}
          disabled={supplyDocBusySlot !== null}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onSupplyMissingDoc(supplySlot, file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          disabled={supplyDocBusySlot !== null}
          onClick={() => {
            const el = document.getElementById(
              `${supplyInputBaseId}-gap-${f.rule.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
            ) as HTMLInputElement | null;
            el?.click();
          }}
        >
          {supplyDocBusySlot === supplySlot ? "Responding…" : supplyLabel}
        </Button>
      </>
    ) : null}
    </div>
  );
}
