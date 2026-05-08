import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

export function getStoredMatchScoringConfig(): Record<string, unknown> | null {
  const db = getRfqDb();
  const row = db
    .prepare(`SELECT config_json FROM rfq_match_settings WHERE id = 1`)
    .get() as { config_json: string } | undefined;
  if (!row?.config_json) return null;
  try {
    return JSON.parse(row.config_json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function saveStoredMatchScoringConfig(config: Record<string, unknown>): void {
  const db = getRfqDb();
  db.prepare(
    `INSERT INTO rfq_match_settings (id, config_json, updated_at)
     VALUES (1, @config_json, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       config_json = excluded.config_json,
       updated_at = excluded.updated_at`,
  ).run({
    config_json: JSON.stringify(config),
  });
}

export function clearStoredMatchScoringConfig(): void {
  const db = getRfqDb();
  db.prepare(`DELETE FROM rfq_match_settings WHERE id = 1`).run();
}

