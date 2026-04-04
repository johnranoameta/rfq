import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { mkdirSync } from "fs";
import { dirname, join } from "path";

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
  return dbSingleton;
}
