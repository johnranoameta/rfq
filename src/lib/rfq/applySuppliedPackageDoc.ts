import type { CaseData, DocType } from "@/data/rfqTypes";

import { reconcileCaseGapsWithDocuments } from "@/lib/rfq/reconcileGapsWithDocuments";



/** Demo: multi-item tech-spec row — any Replace/Upload sets green confidence (ignores uploaded filename). */

const DEMO_GREEN_CONFIDENCE_SLOT = "NB-MAT-SPEC-MQU-TS-014.pdf";

const DEMO_GREEN_CONFIDENCE = 0.93;



function confidenceAfterSupply(slotName: string): number {

  if (slotName === DEMO_GREEN_CONFIDENCE_SLOT) return DEMO_GREEN_CONFIDENCE;

  return 0.88;

}



function noteAfterReplace(slotName: string, suppliedFileLabel: string): string {

  if (slotName === DEMO_GREEN_CONFIDENCE_SLOT) {

    return `Verified on file: “${suppliedFileLabel}”.`;

  }

  return `Replaced or verified in session with “${suppliedFileLabel}”.`;

}



function noteAfterFirstSupply(_slotName: string, suppliedFileLabel: string): string {

  return `Supplied in session as “${suppliedFileLabel}”.`;

}



function triggeredRulesToRemoveForDocType(type: DocType): string[] {

  if (type === "pkg") return ["RULE_001"];

  if (type === "test") return ["RULE_002", "RULE_028"];

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



  if (slotDoc.status === "ok") {

    const conf = confidenceAfterSupply(slotName);

    const note = noteAfterReplace(slotName, suppliedFileLabel);

    const nextDocs = c.docs.map((d) =>

      d.name === slotName

        ? {

            ...d,

            conf,

            note,

          }

        : d,

    );

    const withDocs = { ...c, docs: nextDocs };



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



  if (slotDoc.status !== "miss" && slotDoc.status !== "pend") return c;



  const conf = confidenceAfterSupply(slotName);

  const firstNote = noteAfterFirstSupply(slotName, suppliedFileLabel);



  const docs = c.docs.map((d) =>

    d.name === slotName

      ? {

          ...d,

          status: "ok" as const,

          conf,

          note: firstNote,

        }

      : d,

  );



  const withDocs = { ...c, docs };



  if (withDocs.gap_catalog?.length) {

    return reconcileCaseGapsWithDocuments(withDocs);

  }



  const removeRules = new Set(triggeredRulesToRemoveForDocType(slotDoc.type));

  const triggered_rules = c.triggered_rules.filter((r) => !removeRules.has(r));

  const gap_findings = c.gap_findings.filter((g) => !removeRules.has(g.rule));



  const missingCount = docs.filter((d) => d.status === "miss").length;



  const completeness: CaseData["completeness"] =

    missingCount === 0 ? "complete" : c.completeness === "missing" ? "missing" : "incomplete";



  const status_label =

    missingCount === 0 ? "Ready" : missingCount >= 2 ? "Incomplete" : "Review";



  const deltaRisk =

    slotDoc.type === "pkg" ? 14 : slotDoc.type === "test" ? 18 : 10;

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

    ...c,

    docs,

    triggered_rules,

    gap_findings,

    gap_workflow,

    completeness,

    status_label,

    risk_score,

    quote,

  };

}


