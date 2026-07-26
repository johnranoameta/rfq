/**
 * Seeds the supplier_parts table with sample rows for locally testing the
 * dual-source cost lookup module (issue #5). Writes to the same DB path the
 * app itself resolves (RFQ_DATABASE_PATH, or data/rfq.sqlite by default).
 *
 * IMPORTANT: the "external" rows here are FABRICATED demo data, clearly
 * labeled "(mock)" in the source column — not real TrustedParts.com pricing.
 * For real pricing, run scripts/refresh-trustedparts-price.mjs (requires
 * TRUSTEDPARTS_COMPANY_ID + TRUSTEDPARTS_API_KEY), which writes
 * source: "Trustedparts.com" (no "(mock)" suffix) instead.
 *
 * Run: node scripts/seed-supplier-parts-sample.mjs
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dbPath = process.env.RFQ_DATABASE_PATH || path.join(root, "data", "rfq.sqlite");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS supplier_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_number TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  source TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  unit_cost REAL,
  price_breaks_json TEXT,
  quote_date TEXT,
  fetched_at TEXT,
  lead_time TEXT,
  approval_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_parts_supplier_part ON supplier_parts(supplier_id, part_number);
`);

const upsert = db.prepare(`
  INSERT INTO supplier_parts (part_number, supplier_id, source, currency, unit_cost, price_breaks_json, quote_date, fetched_at, updated_at)
  VALUES (@part_number, @supplier_id, @source, @currency, @unit_cost, @price_breaks_json, @quote_date, @fetched_at, datetime('now'))
  ON CONFLICT(supplier_id, part_number) DO UPDATE SET
    unit_cost = excluded.unit_cost,
    price_breaks_json = excluded.price_breaks_json,
    quote_date = excluded.quote_date,
    fetched_at = excluded.fetched_at,
    updated_at = datetime('now')
`);

function internal(part_number, unit_cost, quote_date, lead_time = "4 weeks") {
  return {
    part_number,
    supplier_id: "ACME",
    source: "Internal",
    currency: "USD",
    unit_cost,
    price_breaks_json: null,
    quote_date,
    fetched_at: null,
    lead_time,
    approval_status: "approved",
  };
}

function trustedPartsMock(part_number, tiers, fetched_at) {
  return {
    part_number,
    supplier_id: "TRUSTEDPARTS",
    source: "Trustedparts.com (mock)",
    currency: "USD",
    unit_cost: null,
    price_breaks_json: JSON.stringify(tiers),
    quote_date: null,
    fetched_at,
    lead_time: null,
    approval_status: null,
  };
}

const rows = [
  // Issue #5's worked example: external wins at qty 1,500 (both present, no risk flag).
  internal("ABC-123", 0.072, "2025-03-10"),
  trustedPartsMock("ABC-123", [{ min_qty: 1000, unit_cost: 0.0685 }], "2026-07-20"),

  // Wide disagreement -> riskFlag: true.
  internal("RISKY-1", 1.0, "2025-01-01"),
  trustedPartsMock("RISKY-1", [{ min_qty: 1, unit_cost: 0.5 }], "2026-07-24"),

  // Internal only -> no implied comparison.
  internal("ONLY-INTERNAL", 1.25, "2025-01-01"),

  // Stale external row (fetched > 7 days ago) -> externalStale: true.
  internal("STALE-1", 0.3, "2025-06-01"),
  trustedPartsMock("STALE-1", [{ min_qty: 1, unit_cost: 0.28 }], "2026-01-01"),

  // NorthBridge stamping bracket sample program (matches docs/rfq-demo-real-layout mockup part numbers).
  // Internal wins at low qty, multi-tier on both sides.
  internal("NB-BRK-3301-A", 3.85, "2024-11-15", "8 weeks"),
  trustedPartsMock(
    "NB-BRK-3301-A",
    [
      { min_qty: 1, unit_cost: 4.6 },
      { min_qty: 500, unit_cost: 4.1 },
      { min_qty: 5000, unit_cost: 3.9 },
    ],
    "2026-07-15",
  ),

  // Fastener — external consistently cheaper at volume.
  internal("FST-M6-ZN2", 0.09, "2024-06-01", "2 weeks"),
  trustedPartsMock(
    "FST-M6-ZN2",
    [
      { min_qty: 1, unit_cost: 0.11 },
      { min_qty: 1000, unit_cost: 0.07 },
      { min_qty: 10000, unit_cost: 0.05 },
    ],
    "2026-07-22",
  ),

  // Grommet seal — external only, no approved internal supplier yet.
  trustedPartsMock("NB-SEAL-EPDM1", [{ min_qty: 1, unit_cost: 0.14 }], "2026-07-18"),

  // Connector pin — internal and external closely agree (no risk flag).
  internal("CTS-FST-1187", 0.032, "2025-02-20", "5 weeks"),
  trustedPartsMock(
    "CTS-FST-1187",
    [
      { min_qty: 1, unit_cost: 0.035 },
      { min_qty: 2500, unit_cost: 0.031 },
    ],
    "2026-07-21",
  ),

  // Matches the built-in demo workbook's quote line (Rear Floor Mounting Bracket, single-item case)
  // so the Costing agent tab has real data to show against the demo out of the box.
  internal("NB-RF-2388", 4.38, "2025-01-15", "6 weeks"),
  trustedPartsMock(
    "NB-RF-2388",
    [
      { min_qty: 1, unit_cost: 4.55 },
      { min_qty: 50000, unit_cost: 4.3 },
      { min_qty: 200000, unit_cost: 4.12 },
    ],
    "2026-07-23",
  ),

  // Matches the built-in demo workbook's multi-item quote line.
  internal("NB-RF-3100", 4.38, "2025-01-15", "6 weeks"),
  trustedPartsMock(
    "NB-RF-3100",
    [
      { min_qty: 1, unit_cost: 4.6 },
      { min_qty: 50000, unit_cost: 4.35 },
      { min_qty: 180000, unit_cost: 4.05 },
    ],
    "2026-07-23",
  ),

  // Real manufacturer part numbers from docs/sample_supplier_and_part_data.xlsx (the
  // AAG quote sample), so the Costing agent's BOM-upload flow has something to
  // resolve against out of the box, once that workbook is uploaded to an RFQ.
  internal("DRW S05137-38", 1.026, "2025-03-10", "5 weeks"),
  trustedPartsMock("DRW S05137-38", [{ min_qty: 1, unit_cost: 0.94 }, { min_qty: 5000, unit_cost: 0.87 }], "2026-07-20"),

  internal("08053C104K4T2A", 0.006, "2025-03-10", "3 weeks"),
  trustedPartsMock(
    "08053C104K4T2A",
    [
      { min_qty: 1, unit_cost: 0.0072 },
      { min_qty: 10000, unit_cost: 0.0041 },
    ],
    "2026-07-20",
  ),
];

for (const r of rows) upsert.run(r);

console.log(`Seeded ${rows.length} supplier_parts rows into ${dbPath}`);
console.log('(External rows are labeled "Trustedparts.com (mock)" — fabricated demo data, not real pricing.)');
console.log("Try:");
console.log("  GET /api/rfq/cost-lookup?partNumber=ABC-123&quantity=1500          (external wins, ~4.9% diff)");
console.log("  GET /api/rfq/cost-lookup?partNumber=RISKY-1&quantity=100           (riskFlag: true, 50% disagreement)");
console.log("  GET /api/rfq/cost-lookup?partNumber=ONLY-INTERNAL&quantity=100     (internal_only)");
console.log("  GET /api/rfq/cost-lookup?partNumber=STALE-1&quantity=100           (externalStale: true)");
console.log("  GET /api/rfq/cost-lookup?partNumber=NB-BRK-3301-A&quantity=180000  (internal wins, close at volume)");
console.log("  GET /api/rfq/cost-lookup?partNumber=NB-BRK-3301-A&quantity=100     (internal wins, riskFlag: true)");
console.log("  GET /api/rfq/cost-lookup?partNumber=FST-M6-ZN2&quantity=10000      (external wins big at volume)");
console.log("  GET /api/rfq/cost-lookup?partNumber=NB-SEAL-EPDM1&quantity=1       (external_only)");
console.log("  GET /api/rfq/cost-lookup?partNumber=CTS-FST-1187&quantity=2500     (close agreement, no risk flag)");
console.log("  GET /api/rfq/cost-lookup?partNumber=NOPE-000&quantity=10           (status: none)");
