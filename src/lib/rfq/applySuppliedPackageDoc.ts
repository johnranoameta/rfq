import type { CaseData, DocType } from "@/data/rfqTypes";

import { evaluateDocumentSupply } from "@/lib/rfq/gapDocumentSupply";
import {
  DOC_GAP_CONF_THRESHOLD,
  reconcileCaseGapsWithDocuments,
} from "@/lib/rfq/reconcileGapsWithDocuments";

function triggeredRulesToRemoveForDocSlot(c: CaseData, slotName: string, slotType: DocType): string[] {
  if (c.gap_catalog?.length) {
    return c.gap_catalog.filter((g) => g.doc_slot === slotName).map((g) => g.rule);
  }
  if (slotName === "NB-QA-118_Customer_Spec.pdf") return ["RULE_028"];
  if (slotType === "pkg") return ["RULE_001"];
  if (slotType === "test") return ["RULE_002"];
  return [];
}

function sumCostBreakdown(b: CaseData["quote"]["cost_breakdown"]): number {
  return (
    b.material +
    b.labor +
    b.machine +
    b.overhead +
    b.scrap +
    b.quality +
    b.logistics +
    b.packaging
  );
}

function applyDocSupplyFields(
  d: CaseData["docs"][number],
  conf: number,
  note: string,
  suppliedFileLabel: string,
) {
  return {
    ...d,
    conf,
    note,
    supplied_label: suppliedFileLabel,
    finalized: false,
  };
}

/** Whether the user uploaded a file to this slot in the current session. */
export function gapSlotHasSessionUpload(c: CaseData, slotName: string): boolean {
  const doc = c.docs.find((d) => d.name === slotName);
  return Boolean(doc?.supplied_label);
}

function ensureDocsBaseline(c: CaseData, slotName: string): CaseData {
  if (c.docs_baseline?.some((d) => d.name === slotName)) return c;
  const doc = c.docs.find((d) => d.name === slotName);
  if (!doc) return c;
  const snapshot: CaseData["docs"][number] = {
    ...doc,
    supplied_label: undefined,
    finalized: undefined,
  };
  return {
    ...c,
    docs_baseline: [...(c.docs_baseline ?? []), snapshot],
  };
}

function baselineDocForSlot(c: CaseData, slotName: string): CaseData["docs"][number] | null {
  const baseline = c.docs_baseline?.find((d) => d.name === slotName);
  if (baseline) {
    return { ...baseline, supplied_label: undefined, finalized: undefined };
  }
  const doc = c.docs.find((d) => d.name === slotName);
  if (!doc) return null;
  if (!doc.supplied_label && !doc.finalized) return null;
  return {
    ...doc,
    status: doc.status === "pend" ? "pend" : "miss",
    conf: null,
    supplied_label: undefined,
    finalized: undefined,
  };
}

/**
 * Removes a session upload from a document slot and reopens linked gaps.
 */
export function clearSuppliedPackageDoc(c: CaseData, slotName: string, rule?: string): CaseData {
  const doc = c.docs.find((d) => d.name === slotName);
  if (!doc?.supplied_label && !doc?.finalized) return c;

  const baseline = baselineDocForSlot(c, slotName);
  if (!baseline) return c;

  const docs = c.docs.map((d) => (d.name === slotName ? baseline : d));

  const wf = { ...(c.gap_workflow ?? {}) };
  if (rule) {
    wf[rule] = "open";
  } else {
    for (const g of c.gap_catalog ?? []) {
      if (g.doc_slot === slotName) wf[g.rule] = "open";
    }
  }

  const withBaseline = ensureDocsBaseline(c, slotName);
  const docs_baseline = withBaseline.docs_baseline?.map((d) =>
    d.name === slotName ? { ...baseline, supplied_label: undefined, finalized: undefined } : d,
  );

  const withDocs = { ...c, docs, docs_baseline, gap_workflow: wf };

  if (withDocs.gap_catalog?.length) {
    return reconcileCaseGapsWithDocuments(withDocs);
  }

  return withDocs;
}

/**
 * Finalizes the current file for one gap rule (does not affect other gaps).
 */
export function finalizeGapDocument(c: CaseData, slotName: string, rule: string): CaseData {
  const slotDoc = c.docs.find((d) => d.name === slotName);
  if (!slotDoc?.supplied_label) return c;

  const docs = c.docs.map((d) =>
    d.name === slotName
      ? {
          ...d,
          finalized: true,
          conf: Math.max(d.conf ?? 0, DOC_GAP_CONF_THRESHOLD),
          note: d.note.includes("Finalized")
            ? d.note
            : `${d.note} Finalized for ${rule}.`,
        }
      : d,
  );

  const wf = { ...(c.gap_workflow ?? {}), [rule]: "resolved" as const };

  const withDocs = { ...c, docs, gap_workflow: wf };

  if (withDocs.gap_catalog?.length) {
    return reconcileCaseGapsWithDocuments(withDocs);
  }

  return withDocs;
}

/**
 * Applies a user-supplied file to a package document row (session UI state).
 * - Bundled demos with {@link CaseData.gap_catalog}: gaps recompute from documents.
 * - Otherwise: legacy rule removal for packaging / test slots.
 */
export function applySuppliedPackageDoc(
  c: CaseData,
  slotName: string,
  suppliedFileLabel: string,
): CaseData {
  const slotDoc = c.docs.find((d) => d.name === slotName);
  if (!slotDoc) return c;

  const withBaseline = ensureDocsBaseline(c, slotName);

  const { conf, note } = evaluateDocumentSupply(
    slotName,
    suppliedFileLabel,
    slotDoc.type,
    slotDoc.status === "ok" ? slotDoc.conf : null,
  );

  if (slotDoc.status === "ok") {
    const nextDocs = withBaseline.docs.map((d) =>
      d.name === slotName ? applyDocSupplyFields(d, conf, note, suppliedFileLabel) : d,
    );
    const withDocs = { ...withBaseline, docs: nextDocs };

    if (withDocs.gap_catalog?.length) {
      return reconcileCaseGapsWithDocuments(withDocs);
    }

    if (slotDoc.type !== "comm" || !c.gap_findings.some((g) => g.rule === "RULE_029")) {
      return withDocs;
    }

    const gap_findings = c.gap_findings.filter((g) => g.rule !== "RULE_029");
    const triggered_rules = c.triggered_rules.filter((r) => r !== "RULE_029");
    const risk_score = Math.max(22, c.risk_score - 8);
    const wf = { ...(c.gap_workflow ?? {}) };
    delete wf.RULE_029;

    return {
      ...withDocs,
      gap_findings,
      triggered_rules,
      risk_score,
      gap_workflow: wf,
      quote: { ...c.quote, risk_score },
    };
  }

  if (slotDoc.status !== "miss" && slotDoc.status !== "pend") return withBaseline;

  const docs = withBaseline.docs.map((d) =>
    d.name === slotName
      ? {
          ...applyDocSupplyFields(d, conf, note, suppliedFileLabel),
          status: "ok" as const,
        }
      : d,
  );

  const withDocs = { ...withBaseline, docs };

  if (withDocs.gap_catalog?.length) {
    return reconcileCaseGapsWithDocuments(withDocs);
  }

  const removeRules = new Set(triggeredRulesToRemoveForDocSlot(withDocs, slotName, slotDoc.type));
  const triggered_rules = c.triggered_rules.filter((r) => !removeRules.has(r));
  const gap_findings = c.gap_findings.filter((g) => !removeRules.has(g.rule));

  const missingCount = docs.filter((d) => d.status === "miss").length;

  const completeness: CaseData["completeness"] =
    missingCount === 0 ? "complete" : c.completeness === "missing" ? "missing" : "incomplete";

  const status_label =
    missingCount === 0 ? "Ready" : missingCount >= 2 ? "Incomplete" : "Review";

  const deltaRisk = slotDoc.type === "pkg" ? 14 : slotDoc.type === "test" ? 18 : 10;
  let risk_score = Math.max(22, c.risk_score - deltaRisk);
  if (missingCount === 0) risk_score = Math.min(risk_score, 34);
  else if (missingCount === 1) risk_score = Math.min(risk_score, 48);

  let quote = { ...c.quote, risk_score };

  if (slotDoc.type === "pkg" && quote.lines.length > 0) {
    const pkgVal = 0.1;
    const lines = quote.lines.map((L, i) => (i === 0 ? { ...L, pkg: pkgVal } : L));
    const cost_breakdown = { ...quote.cost_breakdown, packaging: pkgVal };
    cost_breakdown.total = Math.round(sumCostBreakdown(cost_breakdown) * 100) / 100;
    quote = { ...quote, lines, cost_breakdown };
  }

  if (missingCount === 0) {
    const line0 = quote.lines[0];
    const total_value =
      line0 != null
        ? Math.round((line0.vol * line0.price + line0.tooling) * 100) / 100
        : quote.total_value;
    quote = {
      ...quote,
      version: quote.version.includes("Blocked") ? "v1 Draft" : quote.version,
      validity: quote.validity ?? 30,
      total_value: total_value ?? quote.total_value,
    };
  }

  const gap_workflow = { ...(c.gap_workflow ?? {}) };
  for (const r of removeRules) delete gap_workflow[r];

  return {
    ...withDocs,
    triggered_rules,
    gap_findings,
    gap_workflow,
    completeness,
    status_label,
    risk_score,
    quote,
  };
}
