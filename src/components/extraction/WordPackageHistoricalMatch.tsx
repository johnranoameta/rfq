"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CaseData, ItemHistoricalComparison } from "@/data/rfqTypes";
import {
  OverviewTopReferenceCard,
  RfqReferenceMatchPanel,
} from "@/components/rfq/RfqReferenceMatchPanel";
import type { MatchCriteria } from "@/lib/rfq/loadHistoricalKnowledge";

type HistoricalMatchResponse = {
  error?: string;
  criteria?: MatchCriteria;
  meta?: {
    candidatePool?: number;
    projectsSource?: string;
    matchScope?: string;
  };
  item_historical_comparison?: ItemHistoricalComparison[];
};

type WordPackageHistoricalMatchProps = {
  packageId: string;
  packageLabel?: string | null;
};

function criteriaSummary(c: MatchCriteria): string {
  const parts: string[] = [];
  if (c.part_number) parts.push(`P/N ${c.part_number}`);
  if (c.part_name) parts.push(c.part_name);
  if (c.program) parts.push(`program ${c.program}`);
  if (c.material) parts.push(c.material);
  if (c.process) parts.push(c.process);
  return parts.length ? parts.join(" · ") : "limited signals from extracted fields";
}

export default function WordPackageHistoricalMatch({
  packageId,
  packageLabel,
}: WordPackageHistoricalMatchProps) {
  const [rows, setRows] = useState<ItemHistoricalComparison[] | null>(null);
  const [criteria, setCriteria] = useState<MatchCriteria | null>(null);
  const [meta, setMeta] = useState<HistoricalMatchResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/extraction/historical-match?package=${encodeURIComponent(packageId)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as HistoricalMatchResponse;
      if (!res.ok) {
        throw new Error(data.error ?? `Match failed (${res.status})`);
      }
      setRows(data.item_historical_comparison ?? []);
      setCriteria(data.criteria ?? null);
      setMeta(data.meta ?? null);
    } catch (e) {
      setRows(null);
      setCriteria(null);
      setMeta(null);
      setError(e instanceof Error ? e.message : "Failed to load historical matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [packageId]);

  const caseData = useMemo(
    () =>
      ({
        item_historical_comparison: rows ?? [],
        title: criteria?.part_name ?? packageLabel ?? "Word package",
        part_number: criteria?.part_number ?? "—",
        material: criteria?.material ?? "—",
        process: criteria?.process ? [criteria.process] : [],
        customer: criteria?.customer ?? "—",
        program: criteria?.program ?? "—",
      }) as CaseData,
    [rows, criteria, packageLabel],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh match
        </Button>
      </div>

      {criteria ? (
        <p className="text-[11px] text-muted-foreground border border-border/60 rounded-md px-3 py-2 bg-muted/20">
          Match signals from normalized fields: {criteriaSummary(criteria)}
          {meta?.projectsSource ? ` · pool: ${meta.projectsSource}` : null}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      {loading && !rows ? (
        <p className="text-sm text-muted-foreground">Ranking against historical RFQs…</p>
      ) : null}

      {rows && rows.length > 0 ? (
        <>
          <OverviewTopReferenceCard caseData={caseData} onOpenMatches={() => {}} />
          <RfqReferenceMatchPanel caseData={caseData} />
        </>
      ) : null}

      {rows && rows.length === 0 && !loading && !error ? (
        <p className="text-sm text-muted-foreground">
          {(meta?.candidatePool ?? 0) === 0
            ? "Upload at least one other Word RFQ under Training to enable peer matching."
            : "No match rows produced. Ensure normalized section fields include part number, program, or material."}
        </p>
      ) : null}
    </div>
  );
}
