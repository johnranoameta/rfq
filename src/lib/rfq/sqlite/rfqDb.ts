import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { mkdirSync } from "fs";
import { dirname, join } from "path";

import { classifyKbClass, KB_CLASS_ORDER } from "@/lib/rfq/kbCanonicalClasses";
import { normalizedKbLabelKey } from "@/lib/rfq/kbLabelNormalize";

let dbSingleton: Database.Database | null = null;

const PARSE_SESSIONS_DDL = `
CREATE TABLE rfq_parse_sessions (
  session_id TEXT PRIMARY KEY,
  upload_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  customer_name TEXT,
  program_name TEXT,
  part_number TEXT,
  rfq_reference TEXT,
  risk_score INTEGER,
  line_item_count INTEGER NOT NULL DEFAULT 0,
  parse_json TEXT NOT NULL,
  historical_json TEXT NOT NULL,
  gap_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rfq_parse_sessions_stored ON rfq_parse_sessions(stored_filename);
`;

function packDatabaseDir(): string {
  return join(process.cwd(), "project_files", "RFQ_Agent_Test_Files_Pack", "database");
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { ok: number } | undefined;
  return !!row;
}

function ensurePackSchema(db: Database.Database): void {
  const dir = packDatabaseDir();
  if (!tableExists(db, "customers")) {
    const schema = readFileSync(join(dir, "01_schema.sql"), "utf8");
    db.exec(schema);
    const seed = readFileSync(join(dir, "02_seed_data.sql"), "utf8");
    db.exec(seed);
  }
  if (!tableExists(db, "rfq_parse_sessions")) {
    db.exec(PARSE_SESSIONS_DDL);
  }
}

/** Extra historical rows across KB classes (electronics, machining, etc.). Runs once if only base seed (18 RFQs) is present. */
function ensureKbMulticategorySeed(db: Database.Database): void {
  const dir = packDatabaseDir();
  const seedPath = join(dir, "03_kb_multicategory_seed.sql");
  if (!existsSync(seedPath)) return;
  const row = db.prepare("SELECT COUNT(*) AS c FROM rfq_projects WHERE rfq_id >= 19").get() as { c: number };
  if (row.c > 0) return;
  db.exec(readFileSync(seedPath, "utf8"));
}

const HISTORICAL_GAP_FINDINGS_DDL = `
CREATE TABLE IF NOT EXISTS historical_gap_findings (
  project_id TEXT NOT NULL,
  issue_code TEXT NOT NULL,
  issue_summary TEXT NOT NULL,
  resolved_in_final_quote INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  PRIMARY KEY (project_id, issue_code)
);`;

function ensureHistoricalGapFindingsTable(db: Database.Database): void {
  if (!tableExists(db, "historical_gap_findings")) {
    db.exec(HISTORICAL_GAP_FINDINGS_DDL);
  }
}

const KB_UPLOADED_RFQS_DDL = `
CREATE TABLE IF NOT EXISTS kb_uploaded_rfqs (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  record_json TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_kb_uploaded_project ON kb_uploaded_rfqs(project_id);
`;

function ensureKbUploadedRfqsTable(db: Database.Database): void {
  if (!tableExists(db, "kb_uploaded_rfqs")) {
    db.exec(KB_UPLOADED_RFQS_DDL);
  }
}

const MATCH_SETTINGS_DDL = `
CREATE TABLE IF NOT EXISTS rfq_match_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

function ensureMatchSettingsTable(db: Database.Database): void {
  if (!tableExists(db, "rfq_match_settings")) {
    db.exec(MATCH_SETTINGS_DDL);
  }
}

function columnExists(db: Database.Database, table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === col);
}

const KB_CATEGORIES_DDL = `
CREATE TABLE IF NOT EXISTS kb_categories (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  letter TEXT NOT NULL DEFAULT '?',
  icon_bg TEXT NOT NULL DEFAULT '#f0f0f0',
  icon_fg TEXT NOT NULL DEFAULT '#333333',
  profile_id TEXT NOT NULL DEFAULT '',
  blurb TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'system',
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

function ensureKbCategoriesTable(db: Database.Database): void {
  db.exec(KB_CATEGORIES_DDL);
}

function seedCanonicalKbCategories(db: Database.Database): void {
  const n = db.prepare(`SELECT COUNT(*) AS c FROM kb_categories`).get() as { c: number };
  if (n.c > 0) return;
  const ins = db.prepare(
    `INSERT INTO kb_categories (slug, label, letter, icon_bg, icon_fg, profile_id, blurb, source, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'system', ?)`,
  );
  let order = 10;
  for (const m of KB_CLASS_ORDER) {
    ins.run(m.id, m.label, m.letter, m.iconBg, m.iconFg, m.profileId, m.blurb, order);
    order += 10;
  }
}

function ensureRfqProjectsKbSlugColumn(db: Database.Database): void {
  if (!tableExists(db, "rfq_projects")) return;
  if (!columnExists(db, "rfq_projects", "kb_category_slug")) {
    db.exec(`ALTER TABLE rfq_projects ADD COLUMN kb_category_slug TEXT`);
  }
}

function backfillRfqProjectKbSlugs(db: Database.Database): void {
  if (!tableExists(db, "rfq_projects")) return;
  if (!columnExists(db, "rfq_projects", "kb_category_slug")) return;
  const rows = db
    .prepare(
      `SELECT rfq_id, process_family, part_name, program_name FROM rfq_projects WHERE kb_category_slug IS NULL OR TRIM(kb_category_slug) = ''`,
    )
    .all() as { rfq_id: number; process_family: string; part_name: string; program_name: string }[];
  const upd = db.prepare(`UPDATE rfq_projects SET kb_category_slug = ? WHERE rfq_id = ?`);
  for (const r of rows) {
    upd.run(classifyKbClass(r), r.rfq_id);
  }
}

/** Merge kb_categories rows that share the same normalized label (e.g. system `casting` vs AI duplicate). */
function dedupeKbCategoriesByNormalizedLabel(db: Database.Database): void {
  if (!tableExists(db, "kb_categories")) return;
  type CatRow = {
    category_id: number;
    slug: string;
    label: string;
    source: string;
    sort_order: number;
  };
  const rows = db
    .prepare(`SELECT category_id, slug, label, source, sort_order FROM kb_categories`)
    .all() as CatRow[];
  const byKey = new Map<string, CatRow[]>();
  for (const r of rows) {
    const k = normalizedKbLabelKey(r.label);
    if (!k) continue;
    const arr = byKey.get(k) ?? [];
    arr.push(r);
    byKey.set(k, arr);
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => {
      if (a.source === "system" && b.source !== "system") return -1;
      if (b.source === "system" && a.source !== "system") return 1;
      return a.sort_order - b.sort_order || a.category_id - b.category_id;
    });
    const winner = group[0]!;
    for (const L of group.slice(1)) {
      if (tableExists(db, "rfq_projects") && columnExists(db, "rfq_projects", "kb_category_slug")) {
        db.prepare(`UPDATE rfq_projects SET kb_category_slug = ? WHERE kb_category_slug = ?`).run(winner.slug, L.slug);
      }
      if (tableExists(db, "rfq_parse_sessions") && columnExists(db, "rfq_parse_sessions", "kb_category_slug")) {
        db.prepare(
          `UPDATE rfq_parse_sessions SET kb_category_slug = ?, kb_category_label = ? WHERE kb_category_slug = ?`,
        ).run(winner.slug, winner.label, L.slug);
      }
      db.prepare(`DELETE FROM kb_categories WHERE category_id = ?`).run(L.category_id);
    }
  }
}

function ensureParseSessionKbColumns(db: Database.Database): void {
  if (!tableExists(db, "rfq_parse_sessions")) return;
  const cols: [string, string][] = [
    ["kb_category_slug", "TEXT"],
    ["kb_category_label", "TEXT"],
    ["part_display_name", "TEXT"],
    ["process_family_hint", "TEXT"],
  ];
  for (const [name, decl] of cols) {
    if (!columnExists(db, "rfq_parse_sessions", name)) {
      db.exec(`ALTER TABLE rfq_parse_sessions ADD COLUMN ${name} ${decl}`);
    }
  }
}

export function getRfqDatabasePath(): string {
  const fromEnv = process.env.RFQ_DATABASE_PATH?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), "data", "rfq.sqlite");
}

/**
 * Shared SQLite handle (pack schema + seed + persisted PDF analyses).
 * Not for Edge runtime — use only from Node route handlers / server code.
 */
export function getRfqDb(): Database.Database {
  if (dbSingleton) return dbSingleton;
  const dbPath = getRfqDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });
  dbSingleton = new Database(dbPath);
  dbSingleton.pragma("journal_mode = WAL");
  dbSingleton.pragma("foreign_keys = ON");
  ensurePackSchema(dbSingleton);
  ensureKbMulticategorySeed(dbSingleton);
  ensureHistoricalGapFindingsTable(dbSingleton);
  ensureKbUploadedRfqsTable(dbSingleton);
  ensureMatchSettingsTable(dbSingleton);
  ensureKbCategoriesTable(dbSingleton);
  seedCanonicalKbCategories(dbSingleton);
  ensureRfqProjectsKbSlugColumn(dbSingleton);
  ensureParseSessionKbColumns(dbSingleton);
  dedupeKbCategoriesByNormalizedLabel(dbSingleton);
  backfillRfqProjectKbSlugs(dbSingleton);
  return dbSingleton;
}
