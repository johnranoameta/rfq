/**
 * Generates RFQ .xlsx samples matching the structure of RFQ-SEAT-NEW-001.xlsx:
 * Sheets: Header, Line_Items, Technical_Specs, Supplier_Responses
 * Run: node scripts/generate-rfq-sample-workbooks.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../project_files/RFQ_Agent_Test_Files_Pack/workbook_samples");

const HEADER_COLS = [
  "rfq_id",
  "customer",
  "region",
  "annual_volume",
  "currency",
  "sop",
];
const LINE_COLS = [
  "item",
  "part_name",
  "system",
  "subsystem",
  "level",
  "material",
  "process",
  "target_price",
  "tooling",
  "thickness_mm",
  "line_annual_volume",
];
const SPEC_COLS = ["part_name", "spec_text"];
const SUPP_COLS = [
  "supplier",
  "item",
  "quoted_price",
  "lead_time_weeks",
  "assumptions",
  "deviations",
];

/** @typedef {{ rfq_id: string, customer: string, region: string, annual_volume: number, currency: string, sop: string, lines: { item: string, part_name: string, system: string, subsystem: string, level: string, material: string, process: string, target_price: number, tooling: string, spec_text: string, thickness_mm?: number, line_annual_volume?: number }[], suppliers: string[] }} RfqDef */

/** Per-workbook line-level fields so match criteria (thickness, volume bands) differ across samples. */
const VARIED_LINE_FIELDS = {
  "RFQ-ELEC-PCB-001": {
    thickness: [1.6, 0.2, 0.85, 1.05, 0.48],
    lineVol: [118000, 220000, 95000, 175000, 400000],
  },
  "RFQ-MACH-BRK-001": {
    thickness: [25.4, 14.0, 9.525, 31.75],
    lineVol: [52000, 8000, 95000, 14000],
  },
  "RFQ-STMP-CLP-001": {
    thickness: [0.7, 0.45, 1.2, 0.9],
    lineVol: [920000, 2400000, 410000, 1800000],
  },
  "RFQ-INJ-HOU-001": {
    thickness: [2.4, 1.85, 3.1, 2.0],
    lineVol: [220000, 480000, 900000, 310000],
  },
  /** Same line geometry/volumes as INJ-HOU-001 — use with 001 to test matching across different RFQ references. */
  "RFQ-INJ-HOU-002": {
    thickness: [2.4, 1.85, 3.1, 2.0],
    lineVol: [220000, 480000, 900000, 310000],
  },
  "RFQ-ASM-MOD-001": {
    thickness: [null, null, null],
    lineVol: [45000, 12000, 28000],
  },
  "RFQ-CST-HTG-001": {
    thickness: [4.5, 12.0, 8.0],
    lineVol: [32000, 18000, 55000],
  },
  "RFQ-SEAT-NEW-002": {
    thickness: [2.0, 2.8, 1.6, 45],
    lineVol: [62000, 62000, 62000, 120000],
  },
};

/** @param {RfqDef} def */
function applyVariedLineFields(def) {
  const v = VARIED_LINE_FIELDS[def.rfq_id];
  if (!v) return def;
  return {
    ...def,
    lines: def.lines.map((L, i) => ({
      ...L,
      thickness_mm: v.thickness[i] ?? v.thickness[v.thickness.length - 1] ?? null,
      line_annual_volume: v.lineVol[i] ?? v.lineVol[v.lineVol.length - 1],
    })),
  };
}

/** @type {RfqDef[]} */
const RFQS = [
  {
    rfq_id: "RFQ-ELEC-PCB-001",
    customer: "Northwind Avionics",
    region: "NA",
    annual_volume: 120000,
    currency: "USD",
    sop: "2026-11",
    suppliers: ["CircuitWorks", "FlexAssembly", "ProtoFab"],
    lines: [
      {
        item: "001",
        part_name: "Main Controller PCB",
        system: "Flight Display",
        subsystem: "Compute",
        level: "Assembly",
        material: "FR-4, ENIG",
        process: "SMT, Reflow, AOI",
        target_price: 42,
        tooling: "Yes",
        spec_text:
          "Main Controller PCB requires SMT, Reflow, AOI. Materials: FR-4, ENIG. IPC-A-610 Class 3; conformal coat optional per drawing 12-4401.",
      },
      {
        item: "002",
        part_name: "Backlight Flex",
        system: "Flight Display",
        subsystem: "Illumination",
        level: "Component",
        material: "Polyimide, Cu",
        process: "Etching, SMT",
        target_price: 6.5,
        tooling: "Yes",
        spec_text:
          "Backlight Flex requires Etching, SMT. Materials: Polyimide, Cu. Dynamic bend radius 5 mm min; impedance control ±10%.",
      },
      {
        item: "003",
        part_name: "Power FET Module",
        system: "Power Distribution",
        subsystem: "DC-DC",
        level: "Assembly",
        material: "Cu clip, SiC FET",
        process: "Die attach, Wire bond, Encapsulation",
        target_price: 18,
        tooling: "No",
        spec_text:
          "Power FET Module requires Die attach, Wire bond, Encapsulation. Thermal resistance junction-to-case ≤0.45 K/W.",
      },
      {
        item: "004",
        part_name: "Connector Harness",
        system: "Interconnect",
        subsystem: "I/O",
        level: "Assembly",
        material: "Copper, LCP housing",
        process: "Crimping, Overmold",
        target_price: 11,
        tooling: "Yes",
        spec_text:
          "Connector Harness requires Crimping, Overmold. IP67 seal per test plan; pull force 50 N min per contact.",
      },
      {
        item: "005",
        part_name: "EMI Shield Can",
        system: "RF Front End",
        subsystem: "Shielding",
        level: "Component",
        material: "Nickel silver",
        process: "Deep draw, Plating",
        target_price: 3.2,
        tooling: "Yes",
        spec_text:
          "EMI Shield Can requires Deep draw, Plating. Seam weld acceptable; dB shielding per MIL-STD-461G RS103 band A.",
      },
    ],
  },
  {
    rfq_id: "RFQ-MACH-BRK-001",
    customer: "Contoso Robotics",
    region: "EMEA",
    annual_volume: 45000,
    currency: "EUR",
    sop: "2027-01",
    suppliers: ["PrecisionHaus", "CNC-Nord", "TurnPro"],
    lines: [
      {
        item: "001",
        part_name: "Swivel Bracket",
        system: "Arm Joint",
        subsystem: "Structure",
        level: "Component",
        material: "7075-T6",
        process: "5-axis milling, Anodize",
        target_price: 28,
        tooling: "No",
        spec_text:
          "Swivel Bracket requires 5-axis milling, Anodize. True position 0.05 mm on bearing bores; Ra 0.8 on sliding faces.",
      },
      {
        item: "002",
        part_name: "Drive Shaft",
        system: "Transmission",
        subsystem: "Rotary",
        level: "Component",
        material: "17-4 PH",
        process: "Turning, Grinding",
        target_price: 55,
        tooling: "No",
        spec_text:
          "Drive Shaft requires Turning, Grinding. Concentricity 0.01 mm; hardness HRC 38–42 after heat treat.",
      },
      {
        item: "003",
        part_name: "Mounting Plate",
        system: "Base",
        subsystem: "Structure",
        level: "Component",
        material: "6061-T6",
        process: "Milling, Tapping, Chem film",
        target_price: 14,
        tooling: "No",
        spec_text:
          "Mounting Plate requires Milling, Tapping, Chem film. Flatness 0.1 mm over 200 mm; PEM inserts per BOM.",
      },
      {
        item: "004",
        part_name: "Pulley Hub",
        system: "Belt Drive",
        subsystem: "Rotary",
        level: "Component",
        material: "Steel 4140",
        process: "Turning, Keyway broach",
        target_price: 22,
        tooling: "No",
        spec_text:
          "Pulley Hub requires Turning, Keyway broach. Balance grade G6.3; keyway per ISO 2491.",
      },
    ],
  },
  {
    rfq_id: "RFQ-STMP-CLP-001",
    customer: "Fabrikam Appliances",
    region: "APAC",
    annual_volume: 900000,
    currency: "USD",
    sop: "2026-08",
    suppliers: ["StampAsia", "MetalForm Co", "ProgressiveDie Ltd"],
    lines: [
      {
        item: "001",
        part_name: "Chassis Side Rail",
        system: "Cabinet",
        subsystem: "Frame",
        level: "Component",
        material: "DC04 steel",
        process: "Blanking, Progressive die, Powder coat",
        target_price: 4.1,
        tooling: "Yes",
        spec_text:
          "Chassis Side Rail requires Blanking, Progressive die, Powder coat. Tolerance ±0.15 mm on critical tabs; salt spray 240 h.",
      },
      {
        item: "002",
        part_name: "Latch Spring Clip",
        system: "Door",
        subsystem: "Latching",
        level: "Component",
        material: "Spring steel 301",
        process: "Stamping, Heat treat, Passivate",
        target_price: 0.35,
        tooling: "Yes",
        spec_text:
          "Latch Spring Clip requires Stamping, Heat treat, Passivate. Force 12±2 N at 5 mm deflection; fatigue 50k cycles.",
      },
      {
        item: "003",
        part_name: "EMI Gasket Retainer",
        system: "Enclosure",
        subsystem: "EMI",
        level: "Component",
        material: "Galvanized steel",
        process: "Draw forming, Welding spot",
        target_price: 0.92,
        tooling: "Yes",
        spec_text:
          "EMI Gasket Retainer requires Draw forming, Welding spot. No cracks at bend inner R; weld pull 400 N min.",
      },
      {
        item: "004",
        part_name: "Fan Mount Bracket",
        system: "Thermal",
        subsystem: "Airflow",
        level: "Component",
        material: "Al 5052",
        process: "Blanking, Bending",
        target_price: 0.78,
        tooling: "Yes",
        spec_text:
          "Fan Mount Bracket requires Blanking, Bending. Hole pattern per drawing; vibration test per IEC 60068-2-6.",
      },
    ],
  },
  {
    rfq_id: "RFQ-INJ-HOU-001",
    customer: "Litware Medical",
    region: "NA",
    annual_volume: 180000,
    currency: "USD",
    sop: "2027-04",
    suppliers: ["CleanMold", "MedPlast Partners", "GammaPolymers"],
    lines: [
      {
        item: "001",
        part_name: "Pump Housing",
        system: "Fluidics",
        subsystem: "Pump",
        level: "Component",
        material: "PPSU",
        process: "Injection molding",
        target_price: 8.4,
        tooling: "Yes",
        spec_text:
          "Pump Housing requires Injection molding. Biocompatible per ISO 10993; no voids >0.2 mm on pressure face.",
      },
      {
        item: "002",
        part_name: "Display Bezel",
        system: "UI",
        subsystem: "Enclosure",
        level: "Component",
        material: "PC/ABS",
        process: "Injection molding, Laser etch",
        target_price: 5.1,
        tooling: "Yes",
        spec_text:
          "Display Bezel requires Injection molding, Laser etch. UV stable; color ΔE ≤1.0 vs master plaque.",
      },
      {
        item: "003",
        part_name: "Cable Strain Relief",
        system: "Interconnect",
        subsystem: "Cable",
        level: "Component",
        material: "TPU 95A",
        process: "Injection molding",
        target_price: 0.45,
        tooling: "Yes",
        spec_text:
          "Cable Strain Relief requires Injection molding. Shore 95A ±3; pull-out 80 N min on 4 mm OD cable.",
      },
      {
        item: "004",
        part_name: "Battery Door",
        system: "Power",
        subsystem: "Enclosure",
        level: "Component",
        material: "ABS",
        process: "Injection molding, Tampo print",
        target_price: 1.2,
        tooling: "Yes",
        spec_text:
          "Battery Door requires Injection molding, Tampo print. Snap fit life 500 cycles; UL94 V-0 resin.",
      },
    ],
  },
  /** Near-duplicate of RFQ-INJ-HOU-001 for cross-reference matching tests (distinct Header.rfq_id / rfq_reference). */
  {
    rfq_id: "RFQ-INJ-HOU-002",
    customer: "Litware Medical",
    region: "NA",
    annual_volume: 185000,
    currency: "USD",
    sop: "2027-05",
    suppliers: ["CleanMold", "MedPlast Partners", "GammaPolymers"],
    lines: [
      {
        item: "001",
        part_name: "Pump Housing",
        system: "Fluidics",
        subsystem: "Pump",
        level: "Component",
        material: "PPSU",
        process: "Injection molding",
        target_price: 8.35,
        tooling: "Yes",
        spec_text:
          "Pump Housing requires Injection molding. Biocompatible per ISO 10993; no voids >0.2 mm on pressure face.",
      },
      {
        item: "002",
        part_name: "Display Bezel",
        system: "UI",
        subsystem: "Enclosure",
        level: "Component",
        material: "PC/ABS",
        process: "Injection molding, Laser etch",
        target_price: 5.05,
        tooling: "Yes",
        spec_text:
          "Display Bezel requires Injection molding, Laser etch. UV stable; color ΔE ≤1.0 vs master plaque.",
      },
      {
        item: "003",
        part_name: "Cable Strain Relief",
        system: "Interconnect",
        subsystem: "Cable",
        level: "Component",
        material: "TPU 95A",
        process: "Injection molding",
        target_price: 0.44,
        tooling: "Yes",
        spec_text:
          "Cable Strain Relief requires Injection molding. Shore 95A ±3; pull-out 80 N min on 4 mm OD cable.",
      },
      {
        item: "004",
        part_name: "Battery Door",
        system: "Power",
        subsystem: "Enclosure",
        level: "Component",
        material: "ABS",
        process: "Injection molding, Tampo print",
        target_price: 1.18,
        tooling: "Yes",
        spec_text:
          "Battery Door requires Injection molding, Tampo print. Snap fit life 500 cycles; UL94 V-0 resin.",
      },
    ],
  },
  {
    rfq_id: "RFQ-ASM-MOD-001",
    customer: "Adventure Works Mobility",
    region: "NA",
    annual_volume: 60000,
    currency: "USD",
    sop: "2026-09",
    suppliers: ["IntegraLine", "BoxBuild East", "FinalMile EMS"],
    lines: [
      {
        item: "001",
        part_name: "Motor Gearbox Module",
        system: "Propulsion",
        subsystem: "Drive",
        level: "Assembly",
        material: "Mixed BOM",
        process: "Torque test, Grease, Potting",
        target_price: 210,
        tooling: "No",
        spec_text:
          "Motor Gearbox Module requires Torque test, Grease, Potting. Backlash ≤0.5°; noise ≤45 dBA at 3000 rpm.",
      },
      {
        item: "002",
        part_name: "Battery Pack Subassembly",
        system: "Energy",
        subsystem: "Storage",
        level: "Assembly",
        material: "Cells, BMS, Housing",
        process: "Welding, ICT, Burn-in",
        target_price: 380,
        tooling: "No",
        spec_text:
          "Battery Pack Subassembly requires Welding, ICT, Burn-in. UN38.3 documentation; cell balancing ±20 mV.",
      },
      {
        item: "003",
        part_name: "Thermal Stack",
        system: "Cooling",
        subsystem: "Interface",
        level: "Assembly",
        material: "TIM, Cold plate, Fans",
        process: "Torque sequence, Leak test",
        target_price: 95,
        tooling: "No",
        spec_text:
          "Thermal Stack requires Torque sequence, Leak test. ΔT junction-to-ambient ≤18 K at 150 W; leak rate <5 sccm.",
      },
    ],
  },
  {
    rfq_id: "RFQ-CST-HTG-001",
    customer: "Wide World Industrial",
    region: "EMEA",
    annual_volume: 28000,
    currency: "EUR",
    sop: "2027-02",
    suppliers: ["Foundry Baltic", "AluCast SA", "IronWorks EU"],
    lines: [
      {
        item: "001",
        part_name: "Heat Sink Body",
        system: "Power Electronics",
        subsystem: "Thermal",
        level: "Component",
        material: "Al Si12",
        process: "High-pressure die casting, CNC finish",
        target_price: 19,
        tooling: "Yes",
        spec_text:
          "Heat Sink Body requires High-pressure die casting, CNC finish. Porosity class per ASTM E505; flatness 0.05 mm on base.",
      },
      {
        item: "002",
        part_name: "Bracket Foot",
        system: "Mounting",
        subsystem: "Structure",
        level: "Component",
        material: "Ductile iron GJS-500",
        process: "Sand casting, Shot blast, Paint",
        target_price: 31,
        tooling: "Yes",
        spec_text:
          "Bracket Foot requires Sand casting, Shot blast, Paint. UT acceptable per level 2; paint adhesion cross-cut 0.",
      },
      {
        item: "003",
        part_name: "Valve Body",
        system: "Hydraulics",
        subsystem: "Control",
        level: "Component",
        material: "Zinc alloy ZA-12",
        process: "Gravity die casting, Leak test",
        target_price: 14,
        tooling: "Yes",
        spec_text:
          "Valve Body requires Gravity die casting, Leak test. Working pressure 210 bar; no leakage at 1.5× proof.",
      },
    ],
  },
  {
    rfq_id: "RFQ-SEAT-NEW-002",
    customer: "Southridge Automotive",
    region: "LATAM",
    annual_volume: 55000,
    currency: "USD",
    sop: "2027-06",
    suppliers: ["SeatWorks MX", "TrimSource", "FoamTech LATAM"],
    lines: [
      {
        item: "001",
        part_name: "Recliner Mechanism",
        system: "Seating",
        subsystem: "Adjust",
        level: "Assembly",
        material: "Steel, Powder coat",
        process: "Stamping, Welding, Assembly",
        target_price: 48,
        tooling: "Yes",
        spec_text:
          "Recliner Mechanism requires Stamping, Welding, Assembly. Durability 15k cycles; crash pulse per FMVSS where applicable.",
      },
      {
        item: "002",
        part_name: "Headrest Insert",
        system: "Seating",
        subsystem: "Safety",
        level: "Component",
        material: "PP, Glass fiber",
        process: "Injection molding",
        target_price: 4.2,
        tooling: "Yes",
        spec_text:
          "Headrest Insert requires Injection molding. HIC target per program; no sink marks >0.3 mm visible class A adjacent.",
      },
      {
        item: "003",
        part_name: "Seat Track Cover",
        system: "Seating",
        subsystem: "Trim",
        level: "Component",
        material: "TPO",
        process: "Injection molding, Paint",
        target_price: 2.8,
        tooling: "Yes",
        spec_text:
          "Seat Track Cover requires Injection molding, Paint. UV stability 600 kJ/m²; scratch resistance per OEM spec.",
      },
      {
        item: "004",
        part_name: "Anti-submarine Pad",
        system: "Seating",
        subsystem: "Comfort",
        level: "Component",
        material: "PU Foam",
        process: "Foaming",
        target_price: 9,
        tooling: "No",
        spec_text:
          "Anti-submarine Pad requires Foaming. Density 55±5 kg/m³; compression set ≤8% at 70°C.",
      },
    ],
  },
];

function buildWorkbook(def) {
  const headerRows = [
    HEADER_COLS,
    [
      def.rfq_id,
      def.customer,
      def.region,
      def.annual_volume,
      def.currency,
      def.sop,
    ],
  ];
  const lineRows = [
    LINE_COLS,
    ...def.lines.map((L) => [
      L.item,
      L.part_name,
      L.system,
      L.subsystem,
      L.level,
      L.material,
      L.process,
      L.target_price,
      L.tooling,
      L.thickness_mm != null && L.thickness_mm !== "" ? L.thickness_mm : "",
      L.line_annual_volume != null && L.line_annual_volume !== "" ? L.line_annual_volume : "",
    ]),
  ];
  const specRows = [
    SPEC_COLS,
    ...def.lines.map((L) => [L.part_name, L.spec_text]),
  ];
  const suppRows = [SUPP_COLS];
  for (const L of def.lines) {
    for (const supplier of def.suppliers) {
      const jitter = 0.85 + (supplier.length % 7) * 0.03;
      const quoted = Math.round(L.target_price * jitter * 100) / 100;
      const lead = 4 + (parseInt(L.item, 10) % 5) + (supplier.length % 4);
      suppRows.push([
        supplier,
        L.item,
        quoted,
        lead,
        "quote valid 30 days",
        L.tooling === "Yes" ? "tooling amortized separately" : "NRE included where noted",
      ]);
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(headerRows),
    "Header",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(lineRows),
    "Line_Items",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(specRows),
    "Technical_Specs",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(suppRows),
    "Supplier_Responses",
  );
  return wb;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const def of RFQS) {
  const wb = buildWorkbook(applyVariedLineFields(def));
  const filename = `${def.rfq_id}.xlsx`;
  const path = join(OUT_DIR, filename);
  try {
    writeFileSync(path, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    console.log("Wrote", path);
  } catch (e) {
    if (e && e.code === "EBUSY") {
      console.error("Skip (file open in another app):", path);
    } else {
      throw e;
    }
  }
}
