/**
 * Gap demo sample PDFs for NorthBridge demo workbook gap analysis.
 * Run: npm run sample-gap-demo
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "samples", "gap-demo");

const SPECS = [
  {
    filename: "Packaging_Spec.pdf",
    title: "PACKAGING SPECIFICATION",
    subtitle: "Document: Packaging_Spec.pdf  |  RULE_001  |  Slot: Packaging_Spec.pdf",
    body: [
      "Program: NB-EV Crossover  |  Part: NB-RF-2388 Rear Floor Mounting Bracket",
      "",
      "Returnable steel rack — 48 parts per rack.",
      "EPP dunnage; GM1724-A labeling; Plant 02 dock 7.",
      "Target packaging cost: $0.09–0.12/pc at 220K/yr.",
      "",
      "Upload on RULE_001 only. Expected confidence: 94%.",
    ],
  },
  {
    filename: "Packaging_Spec_DRAFT.pdf",
    title: "PACKAGING SPECIFICATION (DRAFT)",
    subtitle: "Document: Packaging_Spec_DRAFT.pdf  |  RULE_001  |  preliminary",
    body: [
      "DRAFT — FOR REVIEW ONLY. Not the controlled Packaging_Spec.pdf release.",
      "",
      "Preliminary rack concept only; dunnage TBD.",
      "",
      "Upload on RULE_001: expected ~71% confidence — gap stays open.",
      "Replace with Packaging_Spec.pdf for full clearance.",
    ],
  },
  {
    filename: "DV_PV_Test_Standard.pdf",
    title: "DV / PV TEST STANDARD",
    subtitle: "Document: DV_PV_Test_Standard.pdf  |  RULE_002",
    body: [
      "Customer test pack per NB-QA-118.",
      "Program: NB-EV Crossover  |  Part: NB-RF-2388",
      "",
      "DV: dimensional layout, material cert, weld/burr audit.",
      "PV: production validation per NorthBridge quality manual.",
      "",
      "Upload on RULE_002 row only. Expected confidence: 95%.",
    ],
  },
  {
    filename: "NB-QA-118_Customer_Spec.pdf",
    title: "NB-QA-118 CUSTOMER SPEC REFERENCE",
    subtitle: "Document: NB-QA-118_Customer_Spec.pdf  |  RULE_028",
    body: [
      "Customer quality spec NB-QA-118 compliance acknowledgment.",
      "Program: NB-EV Crossover  |  Part: NB-RF-2388",
      "",
      "Confirms buyer spec revision, applicability, and tracking ID.",
      "Separate from the DV/PV test execution pack (RULE_002).",
      "",
      "Upload on RULE_028 row only. Expected confidence: 92%.",
    ],
  },
  {
    filename: "DV_PV_Test_Standard_DRAFT.pdf",
    title: "DV / PV TEST STANDARD (DRAFT)",
    subtitle: "Document: DV_PV_Test_Standard_DRAFT.pdf  |  preliminary",
    body: [
      "DRAFT test scope — NB-QA-118 sections incomplete.",
      "",
      "Upload on DV_PV_Test_Standard.pdf row: expected ~73% confidence.",
      "Replace with DV_PV_Test_Standard.pdf for full clearance.",
    ],
  },
  {
    filename: "Appearance_Sample_Approval_Gate.pdf",
    title: "APPEARANCE SAMPLE APPROVAL GATE",
    subtitle: "Document: Appearance_Sample_Approval_Gate.pdf  |  RULE_027",
    body: [
      "Appearance sample approval required prior to PPAP.",
      "Program: NB-EV Crossover  |  Part: NB-RF-2388",
      "",
      "Scheduled customer review: Week 12 pre-PPAP.",
      "Sign-off contact: NorthBridge quality programs.",
      "",
      "Upload on RULE_027 row. Expected confidence: 91%.",
    ],
  },
];

async function writePdf(spec) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);
  const m = 50;
  let y = 792 - m;

  page.drawText(spec.title, {
    x: m,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.14),
  });
  y -= 24;
  page.drawText(spec.subtitle, {
    x: m,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.22, 0.28),
  });
  y -= 28;

  for (const line of spec.body) {
    page.drawText(line, { x: m, y, size: 10, font, color: rgb(0.18, 0.18, 0.22) });
    y -= line === "" ? 10 : 15;
  }

  const outPath = path.join(outDir, spec.filename);
  const pdfBytes = await pdfDoc.save();
  try {
    fs.writeFileSync(outPath, pdfBytes);
    console.log("Wrote", outPath, `(${pdfBytes.length} bytes)`);
  } catch (e) {
    console.warn("Could not write", outPath, "— close the open file and re-run npm run sample-gap-demo");
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const readme = `NorthBridge gap demo — sample response files
================================================

Upload each file on the matching Gap analysis row (demo workbook).

File                                      | Gap rule(s)     | Document slot                      | Expected result
------------------------------------------|-----------------|------------------------------------|------------------
Packaging_Spec.pdf                        | RULE_001        | Packaging_Spec.pdf                 | 94% — clears gap
Packaging_Spec_DRAFT.pdf                  | RULE_001        | Packaging_Spec.pdf                 | 71% — partial, gap open
DV_PV_Test_Standard.pdf                   | RULE_002        | DV_PV_Test_Standard.pdf            | 95% — clears DV/PV test gap
DV_PV_Test_Standard_DRAFT.pdf             | RULE_002        | DV_PV_Test_Standard.pdf            | 73% — partial
NB-QA-118_Customer_Spec.pdf              | RULE_028        | NB-QA-118_Customer_Spec.pdf        | 92% — clears NB-QA-118 gap
Appearance_Sample_Approval_Gate.pdf       | RULE_027        | Appearance_Sample_Approval_Gate.pdf| 91% — clears gap

After upload: use Finalize to lock the file to the gap, or Remove to revert.

Regenerate PDFs: npm run sample-gap-demo
`;

  fs.writeFileSync(path.join(outDir, "README.txt"), readme, "utf8");
  console.log("Wrote", path.join(outDir, "README.txt"));

  for (const spec of SPECS) {
    await writePdf(spec);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
