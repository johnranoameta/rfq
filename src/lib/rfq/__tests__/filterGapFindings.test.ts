import { describe, expect, it } from "vitest";

import type { CaseData, DocEntry, GapFinding } from "@/data/rfqTypes";
import { filterGapFindings } from "@/lib/rfq/filterGapFindings";

function gap(over: Partial<GapFinding>): GapFinding {
  return { rule: "R", sev: "low", cat: "commercial", ...over } as GapFinding;
}

function caseWith(findings: GapFinding[], docs: Partial<DocEntry>[] = []): CaseData {
  return { gap_findings: findings, docs } as unknown as CaseData;
}

/** A gap whose doc_slot points at a finalized document counts as finalized. */
const FINALIZED_DOC: Partial<DocEntry> = {
  name: "Spec.pdf",
  supplied_label: "user.pdf",
  finalized: true,
};

describe("filterGapFindings", () => {
  it("returns nothing without a case", () => {
    expect(filterGapFindings(null, "all")).toEqual([]);
  });

  it("hides finalized findings from the 'all' view", () => {
    const open = gap({ rule: "OPEN" });
    const done = gap({ rule: "DONE", doc_slot: "Spec.pdf" });
    const c = caseWith([open, done], [FINALIZED_DOC]);
    expect(filterGapFindings(c, "all").map((f) => f.rule)).toEqual(["OPEN"]);
  });

  it("shows only finalized findings under the 'finalized' filter", () => {
    const open = gap({ rule: "OPEN" });
    const done = gap({ rule: "DONE", doc_slot: "Spec.pdf" });
    const c = caseWith([open, done], [FINALIZED_DOC]);
    expect(filterGapFindings(c, "finalized").map((f) => f.rule)).toEqual(["DONE"]);
  });

  it("narrows by severity, still excluding finalized", () => {
    const c = caseWith([
      gap({ rule: "A", sev: "high" }),
      gap({ rule: "B", sev: "low" }),
      gap({ rule: "C", sev: "high" }),
    ]);
    expect(filterGapFindings(c, "sev-high").map((f) => f.rule)).toEqual(["A", "C"]);
    expect(filterGapFindings(c, "sev-low").map((f) => f.rule)).toEqual(["B"]);
  });

  it("excludes a finalized finding even when its severity matches", () => {
    const c = caseWith(
      [gap({ rule: "A", sev: "high" }), gap({ rule: "B", sev: "high", doc_slot: "Spec.pdf" })],
      [FINALIZED_DOC],
    );
    expect(filterGapFindings(c, "sev-high").map((f) => f.rule)).toEqual(["A"]);
  });

  it("narrows by category", () => {
    const c = caseWith([
      gap({ rule: "A", cat: "commercial" }),
      gap({ rule: "B", cat: "technical" }),
    ]);
    expect(filterGapFindings(c, "cat-technical").map((f) => f.rule)).toEqual(["B"]);
  });

  it("returns an empty list when no finding matches the category", () => {
    const c = caseWith([gap({ rule: "A", cat: "commercial" })]);
    expect(filterGapFindings(c, "cat-nonexistent")).toEqual([]);
  });

  it("does not truncate a category name that contains a hyphen", () => {
    const c = caseWith([gap({ rule: "A", cat: "sub-supplier" as GapFinding["cat"] })]);
    expect(filterGapFindings(c, "cat-sub-supplier").map((f) => f.rule)).toEqual(["A"]);
  });
});
