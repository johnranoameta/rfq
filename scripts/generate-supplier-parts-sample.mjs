/**
 * Sample "Supplier & Part DB" workbook for the dual-source cost lookup module
 * (issue #5) — upload via the Supplier & Part DB workspace to see the internal
 * vs. external-distributor comparison working end-to-end.
 *
 * IMPORTANT: the "TRUSTEDPARTS" rows here are FABRICATED demo data ("(mock)" in the
 * source column) — not real TrustedParts.com pricing. For real pricing, run
 * scripts/refresh-trustedparts-price.mjs (requires TRUSTEDPARTS_COMPANY_ID +
 * TRUSTEDPARTS_API_KEY).
 *
 * Run: npm run sample-supplier-parts
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../project_files");
const OUT_FILE = join(OUT_DIR, "sample-supplier-parts.xlsx");

const COLS = [
  "part_number",
  "supplier_id",
  "source",
  "currency",
  "unit_cost",
  "price_breaks_json",
  "quote_date",
  "fetched_at",
  "lead_time",
  "approval_status",
];

const ROWS = [
  // Issue #5's worked example: internal $0.0720 vs external $0.0685 @ 1,500 pcs -> external wins.
  {
    part_number: "ABC-123",
    supplier_id: "ACME",
    source: "Internal",
    currency: "USD",
    unit_cost: 0.072,
    price_breaks_json: "",
    quote_date: "2025-03-10",
    fetched_at: "",
    lead_time: "6 weeks",
    approval_status: "approved",
  },
  {
    part_number: "ABC-123",
    supplier_id: "TRUSTEDPARTS",
    source: "Trustedparts.com (mock)",
    currency: "USD",
    unit_cost: "",
    price_breaks_json: JSON.stringify([{ min_qty: 1000, unit_cost: 0.0685 }]),
    quote_date: "",
    fetched_at: "2026-07-20",
    lead_time: "",
    approval_status: "",
  },
  // Wide disagreement -> risk flag.
  {
    part_number: "RISKY-1",
    supplier_id: "ACME",
    source: "Internal",
    currency: "USD",
    unit_cost: 1.0,
    price_breaks_json: "",
    quote_date: "2025-01-01",
    fetched_at: "",
    lead_time: "4 weeks",
    approval_status: "approved",
  },
  {
    part_number: "RISKY-1",
    supplier_id: "TRUSTEDPARTS",
    source: "Trustedparts.com (mock)",
    currency: "USD",
    unit_cost: "",
    price_breaks_json: JSON.stringify([{ min_qty: 1, unit_cost: 0.5 }]),
    quote_date: "",
    fetched_at: "2026-07-24",
    lead_time: "",
    approval_status: "",
  },
  // Internal only -> no implied comparison.
  {
    part_number: "ONLY-INTERNAL",
    supplier_id: "ACME",
    source: "Internal",
    currency: "USD",
    unit_cost: 1.25,
    price_breaks_json: "",
    quote_date: "2025-01-01",
    fetched_at: "",
    lead_time: "3 weeks",
    approval_status: "approved",
  },
];

mkdirSync(OUT_DIR, { recursive: true });

const ws = XLSX.utils.json_to_sheet(ROWS, { header: COLS });
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "supplier_parts");
XLSX.writeFile(wb, OUT_FILE);

console.log(`Wrote ${ROWS.length} rows to ${OUT_FILE}`);
console.log('(External rows are labeled "Trustedparts.com (mock)" — fabricated demo data, not real pricing.)');
console.log("Upload it from the Supplier & Part DB workspace, then look up:");
console.log("  ABC-123 @ 1500        -> external wins, ~4.9% difference");
console.log("  RISKY-1 @ 100         -> risk flag (large disagreement)");
console.log("  ONLY-INTERNAL @ 100   -> internal-only, no comparison implied");
