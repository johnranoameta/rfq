/**
 * Out-of-band worker that fetches real pricing from TrustedParts.com's
 * official Inventory API and upserts it into supplier_parts as the external
 * cost reference for the dual-source cost lookup (issue #5).
 *
 * Requires TRUSTEDPARTS_COMPANY_ID and TRUSTEDPARTS_API_KEY — sign up for a
 * free account at trustedparts.com and request API access under "Additional
 * Features" on the My Account page (human-reviewed approval, not instant).
 * See https://www.trustedparts.com/en/docs/api.
 *
 * NOTE: the exact response field names below are a best-effort guess (the
 * full Swagger spec is a JS app that couldn't be fetched programmatically to
 * verify) — see the matching comment in src/lib/rfq/trustedPartsApiFetcher.ts.
 * If real responses don't match, adjust parseSearchResponse() in both places.
 *
 * Never called from the Next.js API request path — costLookupEngine.ts only
 * reads whatever row this script last wrote.
 *
 * Run: node scripts/refresh-trustedparts-price.mjs <partNumber> [<partNumber> ...]
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dbPath = process.env.RFQ_DATABASE_PATH || path.join(root, "data", "rfq.sqlite");

const EXTERNAL_SUPPLIER_ID = "TRUSTEDPARTS";
const EXTERNAL_SOURCE_LABEL = "Trustedparts.com";
const SEARCH_URL = "https://api.trustedparts.com/v2/search";

const partNumbers = process.argv.slice(2);
if (partNumbers.length === 0) {
  console.error("Usage: node scripts/refresh-trustedparts-price.mjs <partNumber> [<partNumber> ...]");
  process.exit(1);
}

const companyId = process.env.TRUSTEDPARTS_COMPANY_ID;
const apiKey = process.env.TRUSTEDPARTS_API_KEY;
if (!companyId || !apiKey) {
  console.error("TRUSTEDPARTS_COMPANY_ID / TRUSTEDPARTS_API_KEY are not set.");
  console.error("Sign up at trustedparts.com, request API access, then set both env vars.");
  process.exit(1);
}

function parsePrice(price) {
  if (typeof price === "number") return Number.isFinite(price) ? price : null;
  const n = Number(String(price ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseSearchResponse(json, partNumber) {
  const results = json.SearchResults ?? [];
  const match =
    results.find((r) => r.PartNumber?.trim().toUpperCase() === partNumber.trim().toUpperCase()) ?? results[0];
  const offers = match?.Offers ?? [];

  const byQty = new Map();
  for (const offer of offers) {
    for (const b of offer.PriceBreaks ?? []) {
      const unit_cost = parsePrice(b.Price);
      if (unit_cost == null || typeof b.Quantity !== "number") continue;
      const existing = byQty.get(b.Quantity);
      if (existing === undefined || unit_cost < existing) byQty.set(b.Quantity, unit_cost);
    }
  }
  return [...byQty.entries()].map(([min_qty, unit_cost]) => ({ min_qty, unit_cost })).sort((a, b) => a.min_qty - b.min_qty);
}

async function fetchTrustedPartsPricing(partNumber) {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ CompanyId: companyId, ApiKey: apiKey, SearchRequests: [{ PartNumber: partNumber }] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.warn(`  TrustedParts API returned ${res.status} for ${partNumber}`);
    return null;
  }
  const json = await res.json();
  if (json.Errors?.length) {
    console.warn(`  TrustedParts API error for ${partNumber}: ${JSON.stringify(json.Errors)}`);
    return null;
  }
  const tiers = parseSearchResponse(json, partNumber);
  if (tiers.length === 0) {
    console.warn(`  No usable price data for ${partNumber}`);
    return null;
  }
  return { tiers, fetchedAt: new Date().toISOString() };
}

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
  INSERT INTO supplier_parts (part_number, supplier_id, source, currency, unit_cost, price_breaks_json, fetched_at, updated_at)
  VALUES (@part_number, @supplier_id, @source, 'USD', NULL, @price_breaks_json, @fetched_at, datetime('now'))
  ON CONFLICT(supplier_id, part_number) DO UPDATE SET
    price_breaks_json = excluded.price_breaks_json,
    fetched_at = excluded.fetched_at,
    updated_at = datetime('now')
`);

for (const partNumber of partNumbers) {
  console.log(`Fetching ${partNumber} from TrustedParts.com…`);
  const result = await fetchTrustedPartsPricing(partNumber);
  if (!result) {
    console.log(`  Skipped (no data).`);
    continue;
  }
  upsert.run({
    part_number: partNumber,
    supplier_id: EXTERNAL_SUPPLIER_ID,
    source: EXTERNAL_SOURCE_LABEL,
    price_breaks_json: JSON.stringify(result.tiers),
    fetched_at: result.fetchedAt,
  });
  console.log(`  Stored ${result.tiers.length} price tier(s).`);
}

console.log(`Done. Wrote to ${dbPath}`);
