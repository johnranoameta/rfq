/**
 * Gold-sample tech spec for multi-item RFQ demo (upload via Replace → green confidence).
 * Run: node scripts/generate-tech-spec-sample-pdf.mjs  OR  npm run sample-tech-spec-pdf
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "public", "samples", "NB-MAT-SPEC-MQU-TS-014_RevA.pdf");

async function main() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);
  const m = 50;
  let y = 792 - m;

  page.drawText("MATERIAL / TECHNICAL SPECIFICATION", {
    x: m,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.14),
  });
  y -= 28;
  page.drawText("Document: NB-MAT-SPEC-MQU-TS-014   Revision: A   Status: Released", {
    x: m,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.2),
  });
  y -= 36;
  const body = [
    "Program: NB-EV Crossover (MQU-8842)",
    "Applies to: Line 1 — NB-RF-3100 rear floor bracket assy LH",
    "Base metal: SPHC per JIS G3131 (1.6 mm nominal)",
    "Coil direction: transverse to bend axis unless drawing states otherwise",
    "Surface: oil-free, e-coat compatible; no visible edge burrs post-deburr op",
    "Mechanical: yield and tensile per NorthBridge CSR §4.2 (latest IATF cycle)",
    "RoHS / REACH: declarable substances per supplier portal at award",
    "",
    "This file is a demo gold sample. Upload it on the Tech Spec row (Replace)",
    "to simulate a verified Rev A match and green confidence in the dashboard.",
  ];
  for (const line of body) {
    page.drawText(line, { x: m, y, size: 9, font, color: rgb(0.18, 0.18, 0.22) });
    y -= line === "" ? 10 : 14;
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
