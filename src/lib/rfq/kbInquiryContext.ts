import { listBomParts } from "@/lib/rfq/sqlite/bomPartsDb";
import { listKbCategories } from "@/lib/rfq/sqlite/kbCategories";
import {
  getRfqParseSession,
  listRfqParseSessionSummaries,
  type RfqParseSessionFull,
  type RfqParseSessionRow,
} from "@/lib/rfq/sqlite/parseSessions";
import { listSeedRfqProjects } from "@/lib/rfq/sqlite/seedRfqs";

const RFQ_FIELD_GLOSSARY = `RFQ field glossary:
- Each uploaded RFQ (4-sheet workbook, BOM-parts file, AAG single-sheet quote, or technical
  drawing) gets an rfq_label (RFQ1, RFQ2, …) for comparison in chat.
- customer / program / part_number / rfq_reference: header-level commercial identity.
- line_items[]: parsed BOM/quote lines (part_name, material, process, target_price where known).
- bom_parts[]: the BOM Intelligence table for this RFQ — ref_designator, description, quantity,
  unit_cost, mfr_part_number.
- extra_info[]: README/suppliers/specification content that doesn't map to a structured field —
  reference-only (e.g. rated voltage/current read off a technical drawing).
- cost_elements: quoted cost breakdown (labor, overhead, SG&A, profit, packaging, FOB, tooling)
  from an AAG single-sheet quote upload, when present.
- gap_findings / risk_score (0-100) / completeness_status: rule-based completeness and risk
  assessment for this RFQ.
- historical_matches: similarity-ranked comparisons against the knowledge base of past RFQs.`;

function labelSessions(rows: RfqParseSessionRow[]): Map<string, string> {
  const sorted = [...rows].sort((a, b) => a.session_id.localeCompare(b.session_id));
  return new Map(sorted.map((r, i) => [r.session_id, `RFQ${i + 1}`]));
}

/** Detects comparison intent ("compare RFQ1 vs RFQ2", "what's different", …) in recent user turns. */
function wantsComparison(messages: { role: string; content: string }[]): boolean {
  const text = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content.toLowerCase())
    .join(" ");
  return /\b(compare|comparison|difference|differences|diff|versus|vs\.?|between|rfq\s*1|rfq\s*2|rfq1|rfq2)\b/.test(
    text,
  );
}

function compactSessionDigest(
  row: RfqParseSessionFull,
  label: string,
  opts?: { full?: boolean },
): Record<string, unknown> {
  const parsed = row.parse.parsed;
  const lineItems = Array.isArray(parsed.line_items) ? (parsed.line_items as unknown[]) : [];
  const bomRows = listBomParts(row.session_id);
  const limit = opts?.full ? 40 : 12;

  return {
    rfq_label: label,
    session_id: row.session_id,
    original_filename: row.original_filename,
    customer: parsed.customer ?? row.customer_name,
    program: parsed.program ?? row.program_name,
    part_number: parsed.part_number ?? row.part_number,
    rfq_reference: parsed.rfq_reference ?? row.rfq_reference,
    risk_score: row.gap.risk_score,
    completeness_status: row.gap.completeness_status,
    gap_summary: row.gap.summary,
    triggered_rules: row.gap.triggered_rules,
    line_items: lineItems.slice(0, limit),
    bom_parts: bomRows.slice(0, opts?.full ? 60 : 15).map((r) => ({
      ref_designator: r.ref_designator,
      description: r.description,
      quantity: r.quantity,
      unit_cost: r.unit_cost,
      mfr_part_number: r.mfr_part_number,
    })),
    extra_info: Array.isArray(parsed.extra_info) ? parsed.extra_info : undefined,
    cost_elements: parsed.cost_elements ?? undefined,
    historical_matches: row.historical.matches.slice(0, 5).map((m) => ({
      project_id: m.project_id,
      score: m.score,
    })),
  };
}

function truncateContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[context truncated for length — ask about a specific RFQ label]`;
}

export type KbInquiryContextOptions = {
  sessionId?: string | null;
  messages?: { role: string; content: string }[];
};

/** Build context for the KB inquiry agent (all RFQs for comparison + optional primary RFQ). */
export async function buildKbInquiryContext(opts: KbInquiryContextOptions = {}): Promise<string> {
  const parts: string[] = [RFQ_FIELD_GLOSSARY];

  const summaries = listRfqParseSessionSummaries();
  const labelBySessionId = labelSessions(summaries);

  if (summaries.length > 0) {
    parts.push(
      "RFQ index (use RFQ1, RFQ2 labels in answers):",
      JSON.stringify(
        summaries.map((s) => ({
          rfq_label: labelBySessionId.get(s.session_id),
          session_id: s.session_id,
          original_filename: s.original_filename,
          customer: s.customer_name,
          program: s.program_name,
          risk_score: s.risk_score,
        })),
        null,
        0,
      ),
    );
  }

  const compareMode = wantsComparison(opts.messages ?? []) || summaries.length > 1;
  const sid = typeof opts.sessionId === "string" ? opts.sessionId.trim() : "";

  if (compareMode) {
    for (const s of summaries) {
      const full = getRfqParseSession(s.session_id);
      if (!full) continue;
      const label = labelBySessionId.get(s.session_id) ?? s.session_id;
      parts.push(
        `Full RFQ — ${label} (${s.original_filename}):`,
        JSON.stringify(compactSessionDigest(full, label, { full: true }), null, 0),
      );
    }
  } else if (sid) {
    const full = getRfqParseSession(sid);
    if (full) {
      const label = labelBySessionId.get(sid) ?? sid;
      parts.push(`Primary RFQ — ${label}:`, JSON.stringify(compactSessionDigest(full, label, { full: true }), null, 0));
    }
  } else if (summaries.length === 1) {
    const only = summaries[0]!;
    const full = getRfqParseSession(only.session_id);
    if (full) {
      const label = labelBySessionId.get(only.session_id) ?? "RFQ1";
      parts.push(`Full RFQ — ${label}:`, JSON.stringify(compactSessionDigest(full, label, { full: true }), null, 0));
    }
  }

  const categories = listKbCategories();
  if (categories.length > 0) {
    parts.push(
      "Knowledge base classes:",
      JSON.stringify(
        categories.map((c) => ({ slug: c.slug, label: c.label })),
        null,
        0,
      ),
    );
  }

  const seeds = listSeedRfqProjects().slice(0, 6);
  if (seeds.length > 0) {
    parts.push("Historical seed RFQs (samples):", JSON.stringify(seeds, null, 0));
  }

  return truncateContext(parts.join("\n\n"), compareMode ? 120_000 : 64_000);
}
