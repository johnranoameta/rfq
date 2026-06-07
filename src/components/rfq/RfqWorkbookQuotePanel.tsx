"use client";

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
import type { CaseData } from "@/data/rfqTypes";

function formatMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function riskBucket(score: number) {
  if (score >= 80) return "crit" as const;
  if (score >= 60) return "high" as const;
  if (score >= 40) return "med" as const;
  return "low" as const;
}

function riskBadgeClasses(score: number) {
  const b = riskBucket(score);
  if (b === "crit") {
    return "border-red-500/40 bg-red-500/15 dark:text-red-200 text-red-700";
  }
  if (b === "high") {
    return "border-orange-500/40 bg-orange-500/15 dark:text-orange-200 text-orange-700";
  }
  if (b === "med") {
    return "border-amber-400/40 bg-amber-400/15 dark:text-amber-200 text-amber-800";
  }
  return "border-emerald-400/40 bg-emerald-400/15 dark:text-emerald-200 text-emerald-700";
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/25 p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono">
        {label}
      </div>
      <div
        className={[
          "mt-2 text-[14px] font-semibold font-mono",
          accent ? "text-accent dark:text-accent/90" : "text-foreground",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function CostBreakdownBars({ c }: { c: CaseData }) {
  const cb = c.quote.cost_breakdown;
  const l = c.quote.lines[0];
  if (!l) return null;

  const entries = [
    ["Material", cb.material],
    ["Labor", cb.labor],
    ["Machine", cb.machine],
    ["Overhead", cb.overhead],
    ["Scrap", cb.scrap],
    ["Quality / PPAP", cb.quality],
    ["Logistics", cb.logistics],
    ["Packaging", cb.packaging],
  ] as const;

  const maxV = cb.material;

  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => {
        const isWarn =
          (k === "Packaging" && v === 0) || (k === "Logistics" && v < 0.15 && c.incoterm.startsWith("DDP"));
        const barBg = isWarn ? "bg-red-500" : k === "Scrap" ? "bg-orange-500" : "bg-amber-400";

        return (
          <div key={k} className="flex items-center gap-3">
            <div className="w-[140px] text-[12px] text-muted-foreground font-semibold">{k}</div>
            <div className="flex-1 h-2 rounded-full border border-border bg-card/40 overflow-hidden">
              <div
                className={["h-full", barBg].join(" ")}
                style={{ width: `${Math.min(100, (v / maxV) * 100)}%` }}
              />
            </div>
            <div
              className={[
                "w-[90px] text-right font-mono text-[12px] font-semibold",
                isWarn ? "dark:text-red-200 text-red-700" : "text-foreground",
              ].join(" ")}
            >
              {isWarn ? "⚠ " : ""}${v.toFixed(2)}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <div className="w-[140px] text-[12px] text-muted-foreground font-semibold">Total Cost</div>
        <div className="flex-1 h-2 rounded-full border border-border bg-card/40 overflow-hidden">
          <div className="h-full bg-primary" style={{ width: "100%" }} />
        </div>
        <div className="w-[90px] text-right font-mono text-[12px] font-semibold text-foreground">
          ${cb.total.toFixed(2)}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-[140px] text-[12px] text-muted-foreground font-semibold">Unit Price</div>
        <div className="flex-1 h-2 rounded-full border border-border bg-card/40 overflow-hidden">
          <div className="h-full bg-accent" style={{ width: "100%" }} />
        </div>
        <div className="w-[90px] text-right font-mono text-[12px] font-semibold text-accent dark:text-accent/90">
          ${l.price.toFixed(2)}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-[140px] text-[12px] text-muted-foreground font-semibold">Gross Margin</div>
        <div className="flex-1 h-2 rounded-full border border-border bg-card/40 overflow-hidden">
          <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, l.margin)}%` }} />
        </div>
        <div
          className={[
            "w-[90px] text-right font-mono text-[12px] font-semibold",
            l.margin >= 17
              ? "dark:text-emerald-200 text-emerald-700"
              : l.margin >= 13
                ? "dark:text-amber-200 text-amber-800"
                : "dark:text-red-200 text-red-700",
          ].join(" ")}
        >
          {l.margin.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

function HistoricalBenchmark({ c }: { c: CaseData }) {
  const histMatched = c.historical_benchmark.filter((h) => c.quote.hist_match.includes(h.id)).slice(0, 3);
  const [lo, hi] = c.quote.hist_price_band;
  const [tlo, thi] = c.quote.hist_tooling_band;
  const l = c.quote.lines[0];
  if (!l) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {histMatched.map((h) => (
          <div
            key={h.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/20 px-3 py-2"
          >
            <div className="font-mono text-[12px] text-muted-foreground">{h.id}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-foreground font-semibold truncate">
                {h.pn} · {h.material}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {h.vol.toLocaleString()} pcs · PPAP L{h.ppap}
              </div>
            </div>
            <div
              className={[
                "font-mono text-[12px] font-semibold",
                h.award === "Won" ? "dark:text-emerald-200 text-emerald-700" : "dark:text-red-200 text-red-700",
              ].join(" ")}
            >
              ${h.price.toFixed(2)} · {h.award}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-background/25 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
            Hist. Price Band
          </div>
          <div className="font-mono text-sm font-semibold dark:text-emerald-200 text-emerald-700">
            ${lo.toFixed(2)} – ${hi.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/25 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
            This Quote
          </div>
          <div
            className={[
              "font-mono text-sm font-semibold",
              l.price < lo
                ? "dark:text-red-200 text-red-700"
                : l.price > hi
                  ? "dark:text-amber-200 text-amber-800"
                  : "dark:text-emerald-200 text-emerald-700",
            ].join(" ")}
          >
            ${l.price.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/25 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
            Hist. Tooling Band
          </div>
          <div className="font-mono text-sm font-semibold dark:text-emerald-200 text-emerald-700">
            ${tlo.toLocaleString()} – ${thi.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/25 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground font-mono mb-2">
            This Tooling
          </div>
          <div className="font-mono text-sm font-semibold text-accent dark:text-accent/90">
            ${c.quote.total_tooling.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RfqWorkbookQuotePanel({ caseData: c }: { caseData: CaseData }) {
  const line0 = c.quote.lines[0];

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 border-border overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border bg-secondary/15">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1">
              <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground font-mono">
                Quote Summary
              </div>
              <div className="mt-1 font-semibold text-lg">{c.quote.version}</div>
              <div className="text-[12px] text-muted-foreground mt-1">
                Prepared by <span className="font-mono">{c.quote.prepared_by}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={["border", riskBadgeClasses(c.quote.risk_score), "bg-background/30"].join(" ")}
              >
                Risk {c.quote.risk_score}/100
              </Badge>
              <Button
                variant="outline"
                className="border-accent/40 text-accent dark:text-accent/90 hover:bg-accent/10"
                onClick={() => window.alert("Export is not available in this build.")}
              >
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-4 space-y-4">
          {line0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <SummaryStat label="Tooling (est.)" value={`$${c.quote.total_tooling.toLocaleString()}`} accent />
              <SummaryStat
                label="Est. Annual Rev."
                value={`$${formatMoney(line0.price * line0.vol)}`}
              />
              <SummaryStat label="Risk Score" value={`${c.quote.risk_score}/100`} accent />
              <SummaryStat label="Line Count" value={`${c.quote.lines.length}`} />
              <SummaryStat label="PPAP" value={`L${c.ppap}`} />
              <SummaryStat label="Incoterm" value={c.incoterm} />
            </div>
          ) : null}

          <Card className="bg-card/35 border-border">
            <CardHeader className="p-4 pb-2 border-b border-border bg-secondary/10">
              <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
                Quote Line Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Table className="text-[12px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">Part Number</TableHead>
                    <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">Description</TableHead>
                    <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">Plant</TableHead>
                    <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">Volume</TableHead>
                    <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">Unit Price</TableHead>
                    <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">Tooling</TableHead>
                    <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">Packaging/pc</TableHead>
                    <TableHead className="uppercase tracking-[0.08em] text-[11px] font-semibold">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.quote.lines.map((l) => (
                    <TableRow key={l.pn} className="hover:bg-muted/30">
                      <TableCell>
                        <span className="font-mono text-[11px] text-accent dark:text-accent/90">{l.pn}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="text-[12px]">{l.name}</span>
                      </TableCell>
                      <TableCell>{l.plant}</TableCell>
                      <TableCell className="font-mono">{l.vol.toLocaleString()}</TableCell>
                      <TableCell className="font-mono">${l.price.toFixed(2)}</TableCell>
                      <TableCell className="font-mono">${l.tooling.toLocaleString()}</TableCell>
                      <TableCell className="font-mono">
                        <span className={l.pkg === 0 ? "dark:text-red-200 text-red-700" : "text-foreground"}>
                          ${l.pkg.toFixed(2)}
                          {l.pkg === 0 ? " ⚠" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono">
                        <span
                          className={
                            l.margin >= 17
                              ? "dark:text-emerald-200 text-emerald-700"
                              : l.margin >= 13
                                ? "dark:text-amber-200 text-amber-800"
                                : "dark:text-red-200 text-red-700"
                          }
                        >
                          {l.margin.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="bg-card/35 border-border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
                  Cost Breakdown — USD/pc
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <CostBreakdownBars c={c} />
              </CardContent>
            </Card>

            <Card className="bg-card/35 border-border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-[12px] tracking-wide font-semibold text-muted-foreground uppercase">
                  Historical Benchmark — {c.quote.hist_match.length} Projects Matched
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <HistoricalBenchmark c={c} />
                {c.risk_score >= 60 ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-muted-foreground">
                    <div className="font-semibold dark:text-red-200 text-red-700">Risk Flag</div>
                    <div className="mt-1">
                      {c.completeness === "incomplete"
                        ? "Quote release is blocked — missing packaging spec and test standard must be resolved first. Benchmark data is reference only."
                        : "Multiple cost gaps detected across packaging, logistics, and PPAP. Management review may be required before submission."}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
