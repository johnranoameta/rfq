/**
 * Rich multi-line RFQ PDF with placeholder logos and dates.
 * Run: node scripts/generate-multi-item-rfq-pdf.mjs  OR  npm run sample-multi-pdf
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "public", "samples", "Sample_Multi_Item_RFQ.pdf");

async function main() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const m = 44;
  let page = pdfDoc.addPage([W, H]);
  let y = H - m;

  const drawLogo = (x, label, sub, bg, fg) => {
    page.drawRectangle({ x, y: y - 36, width: 120, height: 36, color: bg, borderColor: rgb(0.2, 0.2, 0.25), borderWidth: 0.5 });
    page.drawText(label, { x: x + 8, y: y - 18, size: 11, font: fontBold, color: fg });
    page.drawText(sub, { x: x + 8, y: y - 30, size: 7, font, color: fg });
  };

  // --- Header row: logos + title band ---
  drawLogo(m, "NORTHBRIDGE", "Automotive OEM", rgb(0.07, 0.22, 0.45), rgb(1, 1, 1));
  drawLogo(W - m - 120, "RIVERTON", "Strategic Supplier", rgb(0.35, 0.35, 0.38), rgb(1, 1, 1));

  y -= 52;
  page.drawText("REQUEST FOR QUOTATION (MULTI-LINE SCHEDULE)", {
    x: m,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.14),
  });
  y -= 22;
  page.drawText("RFQ Reference: NB-RFQ-2026-MQU-8842", { x: m, y, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.2) });
  y -= 14;
  page.drawText("Program: NB-EV Crossover  |  Category: Structural stampings  |  Currency: USD", {
    x: m,
    y,
    size: 9,
    font,
    color: rgb(0.25, 0.25, 0.3),
  });
  y -= 18;
  page.drawText("Issue date: 2026-01-08    Response due: 2026-02-15 17:00 CST    Quote valid until: 2026-03-01", {
    x: m,
    y,
    size: 9,
    font,
    color: rgb(0.2, 0.2, 0.28),
  });
  y -= 20;
  page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 1, color: rgb(0.75, 0.76, 0.8) });
  y -= 16;

  page.drawText("Bill-to / Engineering contact: NorthBridge Automotive  |  programs@northbridge-automotive.example", {
    x: m,
    y,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.35),
  });
  y -= 22;

  page.drawText("LINE ITEM SCHEDULE (quote all lines unless noted as optional)", {
    x: m,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.12, 0.18),
  });
  y -= 14;

  const col = [m, m + 28, m + 118, m + 268, m + 328, m + 388, m + 448, m + 508];
  const headers = ["Ln", "Part number", "Description", "Material", "Process", "Ann. vol.", "SOP", "Tol. mm"];
  page.drawRectangle({ x: m, y: y - 14, width: W - 2 * m, height: 14, color: rgb(0.91, 0.92, 0.94) });
  headers.forEach((h, i) => {
    page.drawText(h, { x: col[i], y: y - 11, size: 7, font: fontBold, color: rgb(0.15, 0.15, 0.2) });
  });
  y -= 18;

  const rows = [
    ["1", "NB-RF-3100", "Rear floor bracket assy LH", "SPHC 1.6mm", "stamping", "185000", "2027-08-01", "0.10"],
    ["2", "NB-TR-3101", "Tunnel stiffener insert", "SPCC 1.0mm", "stamping", "240000", "2027-09-01", "0.10"],
    ["3", "NB-SI-3102", "Side impact reinf. trial", "SPFC980Y 1.8", "stamping", "120000", "2027-10-15", "0.05"],
    ["4", "NB-PK-3103", "Packaging dunnage bracket (opt)", "SPHC 2.0mm", "stamping", "90000", "2028-01-10", "0.15"],
  ];

  for (const row of rows) {
    if (y < m + 120) {
      page = pdfDoc.addPage([W, H]);
      y = H - m;
    }
    row.forEach((cell, i) => {
      page.drawText(cell, { x: col[i], y: y - 10, size: 7, font, color: rgb(0.12, 0.12, 0.16) });
    });
    y -= 14;
  }

  y -= 10;
  page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 0.5, color: rgb(0.8, 0.81, 0.85) });
  y -= 16;

  const commercial = [
    "COMMERCIAL & QUALITY (apply to all lines unless line-specific note)",
    "Incoterm: FOB Shanghai",
    "Payment terms: Net 75",
    "Annual price reduction: 2.0% after year 1",
    "PPAP level: Level 3 (all lines)",
    "Logistics: returnable packaging preferred; rack drawings to be supplied by buyer where applicable.",
  ];
  for (const line of commercial) {
    if (y < m + 60) {
      page = pdfDoc.addPage([W, H]);
      y = H - m;
    }
    const bold = line.startsWith("COMMERCIAL");
    page.drawText(line, { x: m, y, size: bold ? 10 : 9, font: bold ? fontBold : font, color: rgb(0.12, 0.14, 0.18) });
    y -= bold ? 16 : 13;
  }

  y -= 8;
  page.drawText("REQUIRED QUOTE RETURN (CONTROLLED NAMING)", {
    x: m,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.12, 0.18),
  });
  y -= 14;

  const namingLines = [
    "Binding commercial response MUST use: Consolidated_Cost_Template_MQU-8842_RevB.xlsx",
    "Interim discussion workbook RFQ-Commercial_Workbook_MQU_v3.xlsx is acceptable for review cycles",
    "but will score as a lower-confidence match vs. the controlled template until re-filed on Rev B.",
  ];
  for (const line of namingLines) {
    if (y < m + 50) {
      page = pdfDoc.addPage([W, H]);
      y = H - m;
    }
    page.drawText(line, { x: m, y, size: 8, font, color: rgb(0.22, 0.14, 0.12) });
    y -= 12;
  }

  y -= 8;
  page.drawText("ATTACHMENT & DOCUMENT CHECKLIST (BY TYPE)", {
    x: m,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.12, 0.18),
  });
  y -= 14;

  const checklist = [
    "[x] Sample_Multi_Item_RFQ.pdf  (RFQ / master schedule)  THIS DOCUMENT",
    "[x] NB-RF-3100_drawing_RevB.pdf  (Drawing, line 1)",
    "[x] NB-MAT-SPEC-MQU-TS-014.pdf  (Tech / material specification)",
    "[x] NorthBridge_CSR_IATF_2026_Supplier_Manual.pdf  (Quality / CSR)",
    "[x] RFQ-Commercial_Workbook_MQU_v3.xlsx  (Commercial / cost  INTERIM  see Rev B template above)",
    "[x] Supplier_NDA_2025.pdf  (NDA)",
    "[ ] Packaging_Spec_MQU.pdf  (Packaging)  REQUIRED  NOT ATTACHED",
    "[ ] DV_PV_Test_NB-QA-118.pdf  (Test spec)  REQUESTED  separate transmittal",
  ];
  for (const line of checklist) {
    if (y < m + 40) {
      page = pdfDoc.addPage([W, H]);
      y = H - m;
    }
    page.drawText(line, { x: m, y, size: 8, font, color: rgb(0.2, 0.2, 0.26) });
    y -= 12;
  }

  y -= 14;
  page.drawText(
    "Submission: upload completed template and exceptions to the supplier portal by response due date. " +
      "Line 4 is optional; indicate no-bid if not quoting.",
    { x: m, y, size: 8, font, color: rgb(0.35, 0.35, 0.42) },
  );
  y -= 28;
  page.drawText("Authorized buyer signature: _________________________    Date: __________", {
    x: m,
    y,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.36),
  });
  y -= 12;
  page.drawText("NorthBridge Automotive Procurement  |  Document class: Confidential", {
    x: m,
    y,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.55),
  });

  const pdfBytes = await pdfDoc.save();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pdfBytes);
  console.log("Wrote", outPath, `(${pdfBytes.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
