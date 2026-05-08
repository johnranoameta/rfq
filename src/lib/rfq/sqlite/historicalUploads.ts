import { randomUUID } from "crypto";

import type { HistoricalProjectRecord } from "@/lib/rfq/historicalKnowledgeTypes";
import { clearHistoricalKnowledgeCache } from "@/lib/rfq/loadHistoricalKnowledge";
import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

export type HistoricalUploadSummary = {
  session_id: string;
  project_id: string;
  original_filename: string;
  source: string;
  customer: string;
  program: string;
  part_number: string;
  created_at: string;
};

export function listHistoricalUploadSummaries(): HistoricalUploadSummary[] {
  const db = getRfqDb();
  const rows = db
    .prepare(
      `SELECT session_id, project_id, original_filename, source, record_json, created_at
       FROM kb_uploaded_rfqs
       ORDER BY datetime(created_at) DESC`,
    )
    .all() as Array<{
    session_id: string;
    project_id: string;
    original_filename: string;
    source: string;
    record_json: string;
    created_at: string;
  }>;

  return rows.map((r) => {
    let record: HistoricalProjectRecord | null = null;
    try {
      record = JSON.parse(r.record_json) as HistoricalProjectRecord;
    } catch {
      record = null;
    }
    return {
      session_id: r.session_id,
      project_id: r.project_id,
      original_filename: r.original_filename,
      source: r.source,
      customer: record?.rfq.customer ?? "—",
      program: record?.rfq.program ?? "—",
      part_number: record?.rfq.part_number ?? "—",
      created_at: r.created_at,
    };
  });
}

export function insertHistoricalUploads(params: {
  records: HistoricalProjectRecord[];
  originalFilename: string;
  source?: string;
}): number {
  const db = getRfqDb();
  const source = params.source?.trim() || "historical_import";
  const insert = db.prepare(
    `INSERT INTO kb_uploaded_rfqs (session_id, project_id, record_json, original_filename, source)
     VALUES (@session_id, @project_id, @record_json, @original_filename, @source)`,
  );
  const run = db.transaction((records: HistoricalProjectRecord[]) => {
    let count = 0;
    for (const rec of records) {
      const pid = rec.project_id?.trim();
      if (!pid) continue;
      insert.run({
        session_id: `hist-${randomUUID()}`,
        project_id: pid,
        record_json: JSON.stringify(rec),
        original_filename: params.originalFilename,
        source,
      });
      count++;
    }
    return count;
  });
  const inserted = run(params.records);
  clearHistoricalKnowledgeCache();
  return inserted;
}

export function deleteHistoricalUploadByProjectId(projectId: string): number {
  const db = getRfqDb();
  const r = db.prepare(`DELETE FROM kb_uploaded_rfqs WHERE project_id = ?`).run(projectId);
  clearHistoricalKnowledgeCache();
  return r.changes;
}

