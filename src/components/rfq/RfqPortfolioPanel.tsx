"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ScoreBand = "high" | "medium" | "low";

type TopMatch = {
  project_id: string;
  item_label: string;
  score_0_1: number;
  band: ScoreBand;
  part_name: string;
};

type PortfolioRfqRow = {
  session_id: string;
  upload_id: string;
  original_filename: string;
  customer_name: string | null;
  program_name: string | null;
  part_number: string | null;
  rfq_reference: string | null;
  risk_score: number | null;
  total_items: number;
  items_with_match: number;
  items_high: number;
  items_medium: number;
  items_low: number;
  items_none: number;
  top_match: TopMatch | null;
  created_at: string;
};

type PortfolioStats = {
  totalRfqs: number;
  totalItems: number;
  itemsWithMatch: number;
  itemsHigh: number;
  itemsMedium: number;
  itemsLow: number;
  itemsNone: number;
  rfqs: PortfolioRfqRow[];
  error?: string;
};

function bandClasses(b: ScoreBand): string {
  if (b === "high") {
    return "border-emerald-400/40 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700";
  }
  if (b === "medium") {
    return "border-amber-400/40 bg-amber-400/10 dark:text-amber-200 text-amber-800";
  }
  return "border-red-500/40 bg-red-500/15 dark:text-red-200 text-red-700";
}

function bandLabel(b: ScoreBand): string {
  if (b === "high") return "HIGH";
  if (b === "medium") return "MED";
  return "LOW";
}

function pct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

function displayRfqId(id: string): string {
  const m = id.match(/^H(\d+)$/i);
  if (!m) return id;
  return `RFQ-SEAT-HIST-${m[1]!.padStart(3, "0")}`;
}

function rfqDisplayLabel(r: PortfolioRfqRow): string {
  return r.rfq_reference?.trim() || `U-${r.session_id.replace(/-/g, "").slice(0, 12)}`;
}

type Sort =
  | "recent"
  | "items"
  | "high_desc"
  | "high_asc"
  | "risk_desc"
  | "risk_asc"
  | "top_score";

type RfqPortfolioPanelProps = {
  onOpenRfq?: (sessionId: string) => void;
};

export function RfqPortfolioPanel({ onOpenRfq }: RfqPortfolioPanelProps) {
  const [data, setData] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bandFilter, setBandFilter] = useState<"all" | ScoreBand | "none">("all");
  const [sort, setSort] = useState<Sort>("recent");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rfq/database/portfolio", { cache: "no-store" });
      const json = (await res.json()) as PortfolioStats;
      if (!res.ok) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [] as PortfolioRfqRow[];
    const q = search.trim().toLowerCase();
    let rows = data.rfqs.filter((r) => {
      if (q) {
        const tokens = [
          rfqDisplayLabel(r),
          r.original_filename,
          r.customer_name ?? "",
          r.program_name ?? "",
          r.part_number ?? "",
          r.rfq_reference ?? "",
          r.top_match?.project_id ?? "",
        ];
        if (!tokens.some((t) => t.toLowerCase().includes(q))) return false;
      }
      if (bandFilter === "all") return true;
      if (bandFilter === "none") return !r.top_match;
      return r.top_match?.band === bandFilter;
    });
    rows = [...rows];
    rows.sort((a, b) => {
      switch (sort) {
        case "items":
          return b.total_items - a.total_items;
        case "high_desc":
          return b.items_high - a.items_high;
        case "high_asc":
          return a.items_high - b.items_high;
        case "risk_desc":
          return (b.risk_score ?? -1) - (a.risk_score ?? -1);
        case "risk_asc":
          return (a.risk_score ?? 999) - (b.risk_score ?? 999);
        case "top_score":
          return (b.top_match?.score_0_1 ?? -1) - (a.top_match?.score_0_1 ?? -1);
        case "recent":
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return rows;
  }, [data, search, bandFilter, sort]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground font-mono py-12 text-center">
        Loading portfolio…
      </div>
    );
  }
  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5 max-w-lg">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm text-destructive">Portfolio unavailable</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3 text-sm text-muted-foreground">
          <p>{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!data || data.rfqs.length === 0) {
    return (
      <Card className="bg-card/45 border-border max-w-2xl">
        <CardContent className="p-6 text-center text-sm text-muted-foreground space-y-3">
          <p>
            No analyzed RFQs yet. Upload a 4-sheet workbook to populate the portfolio.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <PortfolioTile label="RFQs" value={`${data.totalRfqs}`} />
        <PortfolioTile label="Line items" value={`${data.totalItems}`} />
        <PortfolioTile
          label="Strong (HIGH)"
          value={`${data.itemsHigh}`}
          hint={pct(data.itemsHigh, data.totalItems)}
          tone="good"
        />
        <PortfolioTile
          label="Partial (MEDIUM)"
          value={`${data.itemsMedium}`}
          hint={pct(data.itemsMedium, data.totalItems)}
          tone="warn"
        />
        <PortfolioTile
          label="Weak (LOW)"
          value={`${data.itemsLow}`}
          hint={pct(data.itemsLow, data.totalItems)}
          tone="bad"
        />
        <PortfolioTile
          label="No reference"
          value={`${data.itemsNone}`}
          hint={pct(data.itemsNone, data.totalItems)}
          tone="neutral"
        />
      </div>

      <Card className="bg-card/45 border-border overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-border bg-secondary/15">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
                Reuse pipeline — {filtered.length} of {data.rfqs.length} RFQs
              </CardTitle>
              <p className="mt-1 text-[12px] text-muted-foreground max-w-xl">
                Cross-RFQ Reference Score distribution. Sort or filter to surface RFQs with the
                highest reuse potential or the most &ldquo;no-reference&rdquo; items requiring fresh
                costing.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID / customer / program / part"
              className="h-8 flex-1 min-w-[260px] rounded-md border border-border bg-background px-2 text-[12px]"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-8 rounded-md border border-border bg-background px-2 text-[12px] font-mono"
              aria-label="Sort RFQs"
            >
              <option value="recent">Sort: Most recent</option>
              <option value="items">Sort: Most items</option>
              <option value="high_desc">Sort: Most strong matches</option>
              <option value="high_asc">Sort: Fewest strong matches</option>
              <option value="top_score">Sort: Best top match</option>
              <option value="risk_desc">Sort: Highest risk</option>
              <option value="risk_asc">Sort: Lowest risk</option>
            </select>
            <FilterChip active={bandFilter === "all"} onClick={() => setBandFilter("all")}>
              All ({data.rfqs.length})
            </FilterChip>
            <FilterChip
              active={bandFilter === "high"}
              onClick={() => setBandFilter("high")}
              tone="good"
            >
              Top: High
            </FilterChip>
            <FilterChip
              active={bandFilter === "medium"}
              onClick={() => setBandFilter("medium")}
              tone="warn"
            >
              Top: Medium
            </FilterChip>
            <FilterChip
              active={bandFilter === "low"}
              onClick={() => setBandFilter("low")}
              tone="bad"
            >
              Top: Low
            </FilterChip>
            <FilterChip active={bandFilter === "none"} onClick={() => setBandFilter("none")}>
              No match
            </FilterChip>
          </div>

          <div className="overflow-x-auto">
            <Table className="text-[11px] min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>RFQ</TableHead>
                  <TableHead>Customer / program</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Distribution</TableHead>
                  <TableHead className="text-right">High</TableHead>
                  <TableHead className="text-right">Med</TableHead>
                  <TableHead className="text-right">Low</TableHead>
                  <TableHead className="text-right">None</TableHead>
                  <TableHead>Top match</TableHead>
                  <TableHead className="text-right">Risk</TableHead>
                  <TableHead className="w-[60px]" aria-label="Open" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.session_id} className="hover:bg-muted/20">
                    <TableCell className="font-mono">
                      <div className="font-semibold">{rfqDisplayLabel(r)}</div>
                      <div
                        className="text-muted-foreground text-[10px] max-w-[180px] truncate"
                        title={r.original_filename}
                      >
                        {r.original_filename}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {[r.customer_name, r.program_name].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{r.total_items}</TableCell>
                    <TableCell className="min-w-[180px]">
                      <DistributionBar row={r} />
                    </TableCell>
                    <TableCell className="text-right font-mono dark:text-emerald-200 text-emerald-700">
                      {r.items_high}
                    </TableCell>
                    <TableCell className="text-right font-mono dark:text-amber-200 text-amber-800">
                      {r.items_medium}
                    </TableCell>
                    <TableCell className="text-right font-mono dark:text-red-200 text-red-700">
                      {r.items_low}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {r.items_none}
                    </TableCell>
                    <TableCell>
                      {r.top_match ? (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={[
                              "border font-mono text-[10px] uppercase",
                              bandClasses(r.top_match.band),
                            ].join(" ")}
                          >
                            {r.top_match.score_0_1.toFixed(2)} · {bandLabel(r.top_match.band)}
                          </Badge>
                          <span
                            className="font-mono text-[11px] truncate max-w-[160px]"
                            title={`${displayRfqId(r.top_match.project_id)} · ${r.top_match.part_name}`}
                          >
                            {displayRfqId(r.top_match.project_id)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.risk_score != null ? r.risk_score : "—"}
                    </TableCell>
                    <TableCell>
                      {onOpenRfq ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px]"
                          onClick={() => onOpenRfq(r.session_id)}
                        >
                          Open
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DistributionBar({ row }: { row: PortfolioRfqRow }) {
  const total = row.total_items || 1;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="flex h-2.5 w-full rounded-full overflow-hidden border border-border bg-background/30"
      title={`${row.items_high} HIGH · ${row.items_medium} MED · ${row.items_low} LOW · ${row.items_none} none`}
    >
      <div className="bg-emerald-400" style={{ width: seg(row.items_high) }} />
      <div className="bg-amber-400" style={{ width: seg(row.items_medium) }} />
      <div className="bg-red-500" style={{ width: seg(row.items_low) }} />
      <div className="bg-muted-foreground/35" style={{ width: seg(row.items_none) }} />
    </div>
  );
}

function PortfolioTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-400/35 bg-emerald-400/10 dark:text-emerald-200 text-emerald-700"
      : tone === "warn"
        ? "border-amber-400/35 bg-amber-400/10 dark:text-amber-200 text-amber-800"
        : tone === "bad"
          ? "border-red-500/35 bg-red-500/10 dark:text-red-200 text-red-700"
          : tone === "neutral"
            ? "border-border bg-background/25 text-muted-foreground"
            : "border-border bg-card/40 text-foreground";
  return (
    <div className={["rounded-xl border px-3 py-2.5", cls].join(" ")}>
      <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] opacity-80">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold leading-none">{value}</div>
      {hint ? <div className="mt-1 text-[10px] font-mono opacity-75">{hint}</div> : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "good" | "warn" | "bad";
}) {
  const toneCls = !tone
    ? active
      ? "border-accent/50 bg-card text-accent dark:text-accent/90"
      : "border-border bg-background/20 text-muted-foreground hover:bg-background/30"
    : tone === "good"
      ? active
        ? "border-emerald-400/50 bg-emerald-400/15 dark:text-emerald-200 text-emerald-700"
        : "border-emerald-400/30 bg-emerald-400/8 dark:text-emerald-200/90 text-emerald-700/90 hover:bg-emerald-400/15"
      : tone === "warn"
        ? active
          ? "border-amber-400/50 bg-amber-400/15 dark:text-amber-200 text-amber-800"
          : "border-amber-400/30 bg-amber-400/8 dark:text-amber-200/90 text-amber-800/90 hover:bg-amber-400/15"
        : active
          ? "border-red-500/50 bg-red-500/15 dark:text-red-200 text-red-700"
          : "border-red-500/30 bg-red-500/8 dark:text-red-200/90 text-red-700/90 hover:bg-red-500/15";
  return (
    <button
      type="button"
      onClick={onClick}
      className={["h-8 px-3 rounded-lg border font-mono text-[11px] transition", toneCls].join(" ")}
    >
      {children}
    </button>
  );
}
