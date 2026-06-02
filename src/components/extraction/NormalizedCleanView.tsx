"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NormalizedPackage, SectionFieldRow } from "@/lib/extraction/loadNormalized";

function blank(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && !value.trim()) return "";
  return String(value);
}

function statusClass(status: string): string {
  if (status === "complete") return "text-emerald-600 dark:text-emerald-400";
  if (status === "missing_attachment") return "text-destructive";
  if (status === "partial") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

type NormalizedCleanViewProps = {
  pkg: NormalizedPackage;
};

function SectionFieldTable({ fields }: { fields: SectionFieldRow[] }) {
  const rows = fields.length > 0 ? fields : [{ field: "(no fields)", value: "" }];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Field</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={`${row.field}-${i}`}>
            <TableCell className="text-xs align-top font-medium">{blank(row.field)}</TableCell>
            <TableCell className="text-xs align-top whitespace-pre-wrap max-w-3xl">
              {blank(row.value)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function NormalizedCleanView({ pkg }: NormalizedCleanViewProps) {
  const slots = pkg.section_slots ?? [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        One field/value table per section. Empty cells mean no data. Source:{" "}
        <span className="font-mono">normalized.json</span>
        {pkg.normalized_at ? ` · ${pkg.normalized_at}` : ""}
      </p>

      {slots.map((slot) => (
        <details
          key={slot.section_number}
          className="rounded-md border border-border/60 group"
        >
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium flex items-center gap-2 hover:bg-muted/40">
            <span className="font-mono text-xs">{blank(slot.section_number)}</span>
            <span className="flex-1 truncate">{blank(slot.section_display ?? slot.section_title)}</span>
            <span className={`text-xs ${statusClass(slot.status)}`}>{blank(slot.status)}</span>
            <span className="text-xs text-muted-foreground">
              {(slot.fields?.length ?? 0) > 0 ? `${slot.fields?.length ?? 0} fields` : ""}
            </span>
          </summary>
          <div className="px-3 pb-3 border-t border-border/40">
            <SectionFieldTable fields={slot.fields ?? []} />
          </div>
        </details>
      ))}
    </div>
  );
}
