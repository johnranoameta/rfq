"use client";

import { useCallback, useEffect, useState } from "react";
import { MATCH_DIMENSIONS } from "@/components/rfq/RfqReferenceMatchPanel";
import type { KbMainProjectRow } from "@/lib/rfq/kbBucketPartition";
import type { KbCategoryRow } from "@/lib/rfq/sqlite/kbCategories";
import type { MatchScoringConfig } from "@/lib/rfq/matchScoringConfig";
import { SettingsMenu } from "@/components/settings/SettingsMenu";

export type RfqKbMainPanelProps = {
  kbBucket: KbCategoryRow;
  projects: KbMainProjectRow[];
  onOpenPortfolioRfq: (sessionId: string) => void;
};

type KbTab = "summary" | "matching" | "history";

const KB_TABS: { key: KbTab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "matching", label: "Matching" },
  { key: "history", label: "Historical RFQs" },
];

function weightRows(cfg: MatchScoringConfig): { label: string; value: number }[] {
  const w = cfg.weights;
  return [
    { label: "Material exact", value: w.materialExact },
    { label: "Program exact", value: w.programExact },
    { label: "Process exact", value: w.processExact },
    { label: "Customer overlap", value: w.customerOverlap },
    { label: "Part name substring", value: w.partNameSubstring },
    { label: "Exact part number", value: w.exactPartNumber },
    { label: "Name similarity (high)", value: w.partNameSimilarityHigh },
    { label: "Name similarity (med)", value: w.partNameSimilarityMedium },
    { label: "Spec similarity (high)", value: w.specSimilarityHigh },
    { label: "Spec similarity (med)", value: w.specSimilarityMedium },
    { label: "Feature similarity (high)", value: w.featureSimilarityHigh },
    { label: "Feature similarity (med)", value: w.featureSimilarityMedium },
    { label: "Thickness match", value: w.thicknessMatch },
    { label: "Thickness close", value: w.thicknessClose },
    { label: "Volume similar", value: w.volumeSimilar },
    { label: "Volume related", value: w.volumeRelated },
  ];
}

function totalWeights(cfg: MatchScoringConfig): number {
  return weightRows(cfg).reduce((a, r) => a + r.value, 0);
}

function formatProjectRowId(p: KbMainProjectRow): string {
  if (p.session_id) return `U-${p.session_id.replace(/-/g, "").slice(0, 8)}`;
  return `H${String(p.rfq_id).padStart(3, "0")}`;
}

export function RfqKbMainPanel({ kbBucket, projects, onOpenPortfolioRfq }: RfqKbMainPanelProps) {
  const [tab, setTab] = useState<KbTab>("summary");
  const [matchCfg, setMatchCfg] = useState<MatchScoringConfig | null>(null);
  const [cfgError, setCfgError] = useState<string | null>(null);

  const loadCfg = useCallback(async () => {
    setCfgError(null);
    try {
      const res = await fetch("/api/rfq/settings/match", { cache: "no-store" });
      const json = (await res.json()) as { config?: MatchScoringConfig; error?: string };
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setMatchCfg(json.config ?? null);
    } catch (e) {
      setCfgError(e instanceof Error ? e.message : "Failed to load match settings");
      setMatchCfg(null);
    }
  }, []);

  useEffect(() => {
    if (tab !== "matching") return;
    void loadCfg();
  }, [tab, loadCfg]);

  const sumWeights = matchCfg ? totalWeights(matchCfg) : 0;

  return (
    <>
      <div className="ra-canvas-top">
        <div>
          <div className="ra-canvas-title">{kbBucket.label}</div>
          <div className="ra-canvas-sub">
            {projects.length} RFQs in this class (SQLite) · Profile:{" "}
            <span className="ra-mono">{kbBucket.profile_id}</span>
          </div>
        </div>
        <div className="ra-canvas-actions items-center gap-2">
          <SettingsMenu />
          <button type="button" className="ra-btn" onClick={() => void loadCfg()}>
            Refresh match settings
          </button>
        </div>
      </div>

      <div className="ra-tabs">
        {KB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={["ra-tab", tab === t.key ? "active" : ""].join(" ")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ra-canvas-content">
        {tab === "summary" && (
          <>
            <div className="ra-kpi-grid">
              <div className="ra-kpi">
                <div className="ra-kpi-l">KB class</div>
                <div className="ra-kpi-v text-[16px] mt-1">{kbBucket.label}</div>
              </div>
              <div className="ra-kpi">
                <div className="ra-kpi-l">Historical RFQs</div>
                <div className="ra-kpi-v">{projects.length}</div>
              </div>
              <div className="ra-kpi">
                <div className="ra-kpi-l">Profile ID</div>
                <div className="ra-mono text-[11px] mt-2 font-medium">{kbBucket.profile_id}</div>
              </div>
            </div>
            <div className="ra-summary-box">
              {kbBucket.blurb}{" "}
              New workbook uploads get a <strong>model-assigned KB category</strong> (or reuse an existing one) when the
              server is configured for it; otherwise rule-based assignment is used. Legacy seed rows use stored tags plus
              rule-based fallbacks. Categories can grow over time when the classifier proposes a new class.
              {projects.length === 0 ? (
                <span> No rows map here yet—import data or analyze a workbook.</span>
              ) : null}{" "}
              Matching uses weighted signals (material, process, part name, volume, and more). Open the{" "}
              <span className="font-semibold">Matching</span> tab for signal definitions and point weights, or use{" "}
              <span className="font-semibold">Settings → Match scoring</span>. Saved analyses and portfolio-wide views
              live under <span className="font-semibold">Workspace</span> in the sidebar.
            </div>
          </>
        )}

        {tab === "matching" && (
          <div className="space-y-4">
            <div className="ra-summary-box text-[13px]">
              Same match engine applies to every procurement class; weights are global (not per class). Edit in{" "}
              <span className="font-semibold">Settings → Match scoring</span>.
            </div>
            <div className="ra-card">
              <div className="ra-card-h">
                <span className="ra-card-t">Signals used for matching</span>
              </div>
              <div className="ra-card-b overflow-x-auto">
                <table className="ra-table">
                  <thead>
                    <tr>
                      <th>Dimension</th>
                      <th>Detection</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MATCH_DIMENSIONS.map((d) => (
                      <tr key={d.key}>
                        <td className="font-medium">{d.label}</td>
                        <td className="text-[var(--ra-mid)]">{d.reasonMatchers.join(" · ")}</td>
                        <td>
                          <span className="ra-badge ra-badge-b">Scoring signal</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="ra-card">
              <div className="ra-card-h">
                <span className="ra-card-t">Scoring weights</span>
                <SettingsMenu />
              </div>
              <div className="ra-card-b">
                {cfgError ? <div className="text-[13px] text-[var(--ra-red)]">{cfgError}</div> : null}
                {matchCfg ? (
                  weightRows(matchCfg).map((row) => (
                    <div key={row.label} className="ra-score-row">
                      <div className="ra-score-lab">{row.label}</div>
                      <div className="ra-score-track">
                        <div
                          className="ra-score-fill"
                          style={{ width: `${sumWeights ? Math.min(100, (row.value / sumWeights) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="ra-score-pct">{row.value}</div>
                    </div>
                  ))
                ) : (
                  !cfgError && <div className="text-[13px] text-[var(--ra-muted)]">Loading…</div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="ra-card">
            <div className="ra-card-h">
              <span className="ra-card-t">Representative historical RFQs</span>
            </div>
            <div className="ra-card-b overflow-x-auto">
              <table className="ra-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Part</th>
                    <th>Customer</th>
                    <th>Program</th>
                    <th>Material</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.session_id ?? p.rfq_id}>
                      <td className="ra-mono">{formatProjectRowId(p)}</td>
                      <td className="font-medium">{p.part_name}</td>
                      <td>{p.customer_name}</td>
                      <td>{p.program_name}</td>
                      <td className="ra-mono">{p.material_grade ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
