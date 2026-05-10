import { buildKbUploadedPersistPayload } from "@/lib/rfq/buildKbRecordFromParsed";
import { clearHistoricalKnowledgeCache } from "@/lib/rfq/loadHistoricalKnowledge";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

/**
 * Persist parsed upload as a historical KB row (merged into matching via `loadHistoricalProjectsFromDatabase`).
 * Idempotent per `sessionId` (re-analysis replaces the same KB row).
 */
export function upsertKnowledgeBaseFromUpload(params: {
  sessionId: string;
  parsed: Record<string, unknown>;
  originalFilename: string;
  source: "pdf" | "workbook";
}): void {
  const db = getRfqDb();
  const payload = buildKbUploadedPersistPayload(params.sessionId, params.parsed, {
    originalFilename: params.originalFilename,
    source: params.source,
  });

  db.prepare(
    `INSERT INTO kb_uploaded_rfqs (session_id, project_id, record_json, original_filename, source)
     VALUES (@session_id, @project_id, @record_json, @original_filename, @source)
     ON CONFLICT(session_id) DO UPDATE SET
       project_id = excluded.project_id,
       record_json = excluded.record_json,
       original_filename = excluded.original_filename,
       source = excluded.source,
       created_at = datetime('now')`,
  ).run({
    session_id: params.sessionId,
    project_id: payload.aggregate.project_id,
    record_json: JSON.stringify(payload),
    original_filename: params.originalFilename,
    source: params.source,
  });

  clearHistoricalKnowledgeCache();
}
