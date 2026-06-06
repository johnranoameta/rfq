import {
  getNormalizedPackage,
  readNormalizedPackages,
  type NormalizedPackage,
} from "@/lib/extraction/loadNormalized";
import { listKbCategories } from "@/lib/rfq/sqlite/kbCategories";
import { getRfqParseSession, listRfqParseSessionSummaries } from "@/lib/rfq/sqlite/parseSessions";
import { listSeedRfqProjects } from "@/lib/rfq/sqlite/seedRfqs";

const RFQ_FIELD_GLOSSARY = `RFQ field glossary:
Workbook / dashboard fields:
- rfq_num / rfq_reference: customer RFQ identifier
- customer / customer_name: OEM or buyer
- program / program_name: vehicle or product program
- part_number, part_name: component identifiers
- material / material_grade, process / process_family, annual_vol / annual_volume
- sop / sop_date, thickness, tolerance, ppap, cpk, incoterm, payment, risk_score
- gap_findings[], docs[], quote, kb_category_slug / kb_category_label

Word extraction (normalized.json) — primary upload path:
- package_id, filename, rfq_number, title, normalized_at
- section_slots[]: per RFQ section (e.g. 1.0 Commercial, 2.0 Technical)
  - section_number, section_display, status (complete | partial | missing_attachment)
  - fields[]: { field, value } tables parsed from section body and attachments
  - expected_files[]: icon slots with filename, document_role, present, clean_text
  - body_text: section narrative text
- summary: attachment counts, chunk counts, extraction stats
- Attachments include drawings, cost templates, test specs, questionnaires embedded in the Word package`;

function compactParsed(parsed: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    source_form: parsed.source_form,
    customer: parsed.customer,
    program: parsed.program,
    rfq_reference: parsed.rfq_reference,
    workbook_header: parsed.workbook_header,
  };
  if (Array.isArray(parsed.line_items)) {
    out.line_items = (parsed.line_items as unknown[]).slice(0, 12);
  }
  if (Array.isArray(parsed.technical_specs)) {
    out.technical_specs = (parsed.technical_specs as unknown[]).slice(0, 8);
  }
  if (Array.isArray(parsed.required_attachments)) {
    out.required_attachments = (parsed.required_attachments as unknown[]).slice(0, 20);
  }
  return out;
}

function compactNormalizedPackage(pkg: NormalizedPackage): Record<string, unknown> {
  return {
    package_id: pkg.package_id,
    filename: pkg.filename,
    rfq_number: pkg.rfq_number,
    title: pkg.title,
    normalized_at: pkg.normalized_at,
    summary: pkg.summary,
    section_slots: (pkg.section_slots ?? []).map((slot) => ({
      section_number: slot.section_number,
      section_display: slot.section_display ?? slot.section_title,
      status: slot.status,
      fields: (slot.fields ?? []).slice(0, 80),
      body_text: slot.body_text?.slice(0, 3000) ?? "",
      expected_files: (slot.expected_files ?? []).slice(0, 24).map((f) => ({
        filename: f.filename,
        present: f.present,
        document_role: f.document_role,
        file_type: f.file_type,
        clean_text: f.clean_text?.slice(0, 800) ?? "",
      })),
    })),
  };
}

function truncateContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[context truncated for length]`;
}

export type KbInquiryContextOptions = {
  sessionId?: string | null;
  packageId?: string | null;
};

/** Build compact context for the KB inquiry agent (word extraction + catalog + optional session). */
export async function buildKbInquiryContext(opts: KbInquiryContextOptions = {}): Promise<string> {
  const parts: string[] = [RFQ_FIELD_GLOSSARY];

  const normalizedPackages = await readNormalizedPackages();
  if (normalizedPackages.length > 0) {
    parts.push(
      "Word-extracted RFQ packages (summaries):",
      JSON.stringify(
        normalizedPackages.map((p) => ({
          package_id: p.package_id,
          filename: p.filename,
          rfq_number: p.rfq_number,
          title: p.title,
          section_slot_count: p.section_slots?.length ?? 0,
          summary: p.summary,
        })),
        null,
        0,
      ),
    );
  }

  const pid = typeof opts.packageId === "string" ? opts.packageId.trim() : "";
  if (pid) {
    const pkg = (await getNormalizedPackage(pid)) ?? normalizedPackages.find((p) => p.package_id === pid);
    if (pkg) {
      parts.push(
        "Active Word extraction (user-selected package — use this for field-level answers):",
        JSON.stringify(compactNormalizedPackage(pkg), null, 0),
      );
    }
  }

  const categories = listKbCategories();
  if (categories.length > 0) {
    parts.push(
      "Knowledge base classes:",
      JSON.stringify(
        categories.map((c) => ({ slug: c.slug, label: c.label, profile_id: c.profile_id })),
        null,
        0,
      ),
    );
  }

  const seeds = listSeedRfqProjects().slice(0, 10);
  if (seeds.length > 0) {
    parts.push(
      "Sample historical seed RFQs:",
      JSON.stringify(
        seeds.map((s) => ({
          rfq_id: s.rfq_id,
          customer_name: s.customer_name,
          program_name: s.program_name,
          part_name: s.part_name,
          part_number: s.part_number,
          process_family: s.process_family,
          material_grade: s.material_grade,
        })),
        null,
        0,
      ),
    );
  }

  const uploads = listRfqParseSessionSummaries().slice(0, 8);
  if (uploads.length > 0) {
    parts.push(
      "Legacy workbook analyses (if any):",
      JSON.stringify(
        uploads.map((u) => ({
          session_id: u.session_id,
          original_filename: u.original_filename,
          customer_name: u.customer_name,
          program_name: u.program_name,
          part_number: u.part_number,
          rfq_reference: u.rfq_reference,
          risk_score: u.risk_score,
        })),
        null,
        0,
      ),
    );
  }

  const sid = typeof opts.sessionId === "string" ? opts.sessionId.trim() : "";
  if (sid) {
    const row = getRfqParseSession(sid);
    if (row) {
      parts.push(
        "Legacy workbook session context:",
        JSON.stringify(
          {
            session_id: row.session_id,
            original_filename: row.original_filename,
            customer_name: row.customer_name,
            program_name: row.program_name,
            parsed: compactParsed(row.parse.parsed),
            gap_summary: row.gap.summary,
          },
          null,
          0,
        ),
      );
    }
  }

  return truncateContext(parts.join("\n\n"), 48_000);
}
