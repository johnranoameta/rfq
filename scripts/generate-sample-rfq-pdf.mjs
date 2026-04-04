/**
 * One-off generator: node scripts/generate-sample-rfq-pdf.mjs
 * Writes public/samples/Sample_RFQ_NorthBridge.pdf
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "public", "samples", "Sample_RFQ_NorthBridge.pdf");

const LINES = [
  "NORTHBRIDGE AUTOMOTIVE — REQUEST FOR QUOTATION (SAMPLE PDF)",
  "RFQ Ref: NB-RFQ-2025-RF-2388-DEMO",
  "================================================================",
  "",
  "Program: NB-EV Crossover",
  "Buyer contact: programs@northbridge-automotive.example",
  "",
  "1. PART SUMMARY",
  "---------------",
  "Part name:        Rear Floor Mounting Bracket",
  "Part number:      NB-RF-2388",
  "Process family:   stamping, restrike, deburr",
  "Material:         SPHC, thickness 1.6 mm",
  "Annual volume:    220,000 pieces",
  "SOP date:         2027-05-15",
  "General tolerance: ±0.10 mm (unless noted on drawing)",
  "",
  "2. COMMERCIAL",
  "-------------",
  "Incoterm:         FOB Shanghai",
  "Payment terms:    Net 75",
  "Annual price down: 2.0% after year 1",
  "",
  "3. QUALITY",
  "----------",
  "PPAP level:       3",
  "Appearance sample approval is required prior to PPAP.",
  "DV and PV test requirements per customer specification NB-QA-118",
  "(document to be provided under separate cover).",
  "",
  "4. REQUIRED ATTACHMENTS (PACKAGE CHECKLIST)",
  "--------------------------------------------",
  "A1  Cost_Template.xlsx          — supplier to complete",
  "A2  Part_Drawing.pdf            — Rev C (included in full package)",
  "B3  Packaging_Spec.pdf         — returnable rack (REFERENCED; not in this PDF)",
  "C1  DV_PV_Test_Standard.pdf     — per NB-QA-118 (REFERENCED; not in this PDF)",
  "",
  "5. SUBMISSION",
  "-------------",
  "Submit completed cost template and technical exceptions via supplier portal.",
  "",
  "--- End of sample RFQ PDF — upload in RFQ Agent for AI extraction demo ---",
];

async function main() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const lineHeight = 12;
  const fontSize = 10;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function newPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }

  for (const line of LINES) {
    if (y < margin + lineHeight) newPage();
    const useBold =
      line.startsWith("NORTHBRIDGE") ||
      line.startsWith("RFQ Ref:") ||
      /^\d+\.\s/.test(line);
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font: useBold ? fontBold : font,
      color: rgb(0.12, 0.12, 0.14),
    });
    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pdfBytes);
  console.log("Wrote", outPath, `(${pdfBytes.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
