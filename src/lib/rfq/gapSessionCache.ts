import type { CaseData } from "@/data/rfqTypes";
import { reconcileCaseGapsWithDocuments } from "@/lib/rfq/reconcileGapsWithDocuments";

const KEY = "rfq-agent-gap-sessions-v1";

type GapSessionStore = Record<string, CaseData>;

function readStore(): GapSessionStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as GapSessionStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: GapSessionStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

/** Persist gap uploads, finalizations, and workflow for a workbook session (survives refresh). */
export function saveGapSessionCache(fileId: string, caseData: CaseData): void {
  const store = readStore();
  store[fileId] = caseData;
  writeStore(store);
}

export function loadGapSessionCache(fileId: string): CaseData | null {
  const store = readStore();
  const row = store[fileId];
  return row ?? null;
}

export function clearGapSessionCache(fileId: string): void {
  const store = readStore();
  if (!(fileId in store)) return;
  delete store[fileId];
  writeStore(store);
}

/**
 * Merge cached gap/doc state onto a freshly built case (demo pipeline or DB reload).
 */
export function restoreGapSessionCaseData(fileId: string, fresh: CaseData): CaseData {
  const cached = loadGapSessionCache(fileId);
  if (!cached) {
    const baseline = fresh.docs_baseline ?? fresh.docs.map((d) => ({ ...d }));
    const catalog = fresh.gap_catalog?.length ? fresh.gap_catalog : fresh.gap_findings;
    if (!fresh.gap_catalog?.length && catalog.length) {
      return reconcileCaseGapsWithDocuments({ ...fresh, docs_baseline: baseline, gap_catalog: catalog });
    }
    return fresh.docs_baseline ? fresh : { ...fresh, docs_baseline: baseline };
  }

  const docs_baseline = (() => {
    const freshBaseline = fresh.docs_baseline ?? fresh.docs.map((d) => ({ ...d }));
    const cachedBaseline = cached.docs_baseline ?? [];
    const byName = new Map<string, CaseData["docs"][number]>();
    for (const d of cachedBaseline) byName.set(d.name, d);
    for (const d of freshBaseline) byName.set(d.name, d);
    return Array.from(byName.values());
  })();
  const gap_catalog = fresh.gap_catalog?.length
    ? fresh.gap_catalog
    : cached.gap_catalog?.length
      ? cached.gap_catalog
      : fresh.gap_findings;

  const merged: CaseData = {
    ...fresh,
    docs: fresh.docs.map((d) => {
      const cachedDoc = cached.docs.find((x) => x.name === d.name);
      return cachedDoc ?? d;
    }),
    docs_baseline,
    gap_catalog,
    gap_workflow: { ...(cached.gap_workflow ?? {}) },
    triggered_rules: cached.triggered_rules ?? fresh.triggered_rules,
    gap_findings: cached.gap_findings ?? fresh.gap_findings,
    risk_score: cached.risk_score,
    completeness: cached.completeness,
    status_label: cached.status_label,
    quote: cached.quote,
  };

  const wf = { ...(merged.gap_workflow ?? {}) };
  for (const g of gap_catalog ?? []) {
    if (!g.doc_slot) continue;
    const doc = merged.docs.find((d) => d.name === g.doc_slot);
    if (!doc) continue;
    const docStillMissing =
      (doc.status === "miss" || doc.status === "pend") && !doc.supplied_label && !doc.finalized;
    if (docStillMissing && wf[g.rule] === "resolved") {
      wf[g.rule] = "open";
    }
  }
  merged.gap_workflow = wf;

  if (gap_catalog?.length) {
    return reconcileCaseGapsWithDocuments(merged);
  }
  return merged;
}
