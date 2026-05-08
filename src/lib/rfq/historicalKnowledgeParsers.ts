import type { HistoricalGapRecord, HistoricalProjectRecord } from "@/lib/rfq/historicalKnowledgeTypes";

export function parseGapCsv(text: string): HistoricalGapRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rows: HistoricalGapRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^([^,]+),([^,]+),([^,]+),([^,]+),(.*)$/);
    if (!m) continue;
    const resolved = m[4].trim();
    rows.push({
      project_id: m[1].trim(),
      issue_code: m[2].trim(),
      issue_summary: m[3].trim(),
      resolved_in_final_quote: resolved === "1" || resolved.toLowerCase() === "true",
      notes: m[5].trim(),
    });
  }
  return rows;
}

export function parseHistoricalJsonl(text: string): HistoricalProjectRecord[] {
  const out: HistoricalProjectRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as HistoricalProjectRecord);
    } catch {
      /* skip bad line */
    }
  }
  return out;
}
