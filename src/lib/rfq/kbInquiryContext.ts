import {
  getNormalizedPackage,
  readNormalizedPackages,
  type NormalizedPackage,
} from "@/lib/extraction/loadNormalized";
import {
  buildPackageComparisonDigest,
  labelPackages,
  wantsRfqComparison,
} from "@/lib/rfq/kbInquiryCompare";
import { listKbCategories } from "@/lib/rfq/sqlite/kbCategories";
import { getRfqParseSession, listRfqParseSessionSummaries } from "@/lib/rfq/sqlite/parseSessions";
import { listSeedRfqProjects } from "@/lib/rfq/sqlite/seedRfqs";

const RFQ_FIELD_GLOSSARY = `RFQ field glossary:
Word extraction (normalized.json) — primary upload path:
- Each upload is an RFQ package with rfq_label (RFQ1, RFQ2, …) for comparison in chat.
- section_slots[]: per RFQ section (e.g. 1.3 Supplier Request Form)
  - fields[]: { field, value } parsed from forms (Supplier Name, Contact Person, DUNS, etc.)
  - expected_files[] / attachment_forms: embedded Word/Excel/PDF with clean_text
  - Empty template underscores are NOT real values; non-empty text like "TEST" IS a real difference.
- Use supplier_and_commercial_sections in comparison digests for supplier form diffs.

Legacy workbook fields: customer, program, part_number, line_items, gap_findings, etc.`;

function compactParsed(parsed: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    source_form: parsed.source_form,
    customer: parsed.customer,
    program: parsed.program,
    rfq_reference: parsed.rfq_reference,
  };
  if (Array.isArray(parsed.line_items)) {
    out.line_items = (parsed.line_items as unknown[]).slice(0, 12);
  }
  return out;
}

function compactNormalizedPackage(pkg: NormalizedPackage, opts?: { fullForms?: boolean }): Record<string, unknown> {
  const fullForms = opts?.fullForms ?? false;
  const cleanLimit = fullForms ? 12_000 : 2000;

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
      fields: (slot.fields ?? []).filter((f) => {
        const v = (f.value ?? "").trim();
        return v && !/^_+$/.test(v);
      }),
      body_text: slot.body_text?.slice(0, fullForms ? 6000 : 2000) ?? "",
      expected_files: (slot.expected_files ?? []).map((f) => ({
        icon_label: f.icon_label,
        filename: f.filename,
        present: f.present,
        document_role: f.document_role,
        file_type: f.file_type,
        clean_text: f.present ? (f.clean_text?.slice(0, cleanLimit) ?? "") : "",
      })),
    })),
  };
}

function truncateContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[context truncated for length — ask about a specific section or RFQ label]`;
}

export type KbInquiryContextOptions = {
  sessionId?: string | null;
  packageId?: string | null;
  messages?: { role: string; content: string }[];
};

/** Build context for the KB inquiry agent (all RFQs for comparison + optional primary package). */
export async function buildKbInquiryContext(opts: KbInquiryContextOptions = {}): Promise<string> {
  const parts: string[] = [RFQ_FIELD_GLOSSARY];

  const normalizedPackages = await readNormalizedPackages();
  const labels = labelPackages(normalizedPackages);
  const labelById = new Map(labels.map((l) => [l.package_id, l.rfq_label]));

  const compareMode =
    wantsRfqComparison(opts.messages ?? []) || normalizedPackages.length > 1;

  if (labels.length > 0) {
    parts.push(
      "RFQ package index (use RFQ1, RFQ2 labels in answers):",
      JSON.stringify(labels, null, 0),
    );
  }

  if (normalizedPackages.length > 0) {
    parts.push(
      "Cross-RFQ comparison digests (field-level — use for diff questions):",
      JSON.stringify(
        normalizedPackages.map((p) =>
          buildPackageComparisonDigest(p, labelById.get(p.package_id) ?? p.package_id),
        ),
        null,
        0,
      ),
    );
  }

  const pid = typeof opts.packageId === "string" ? opts.packageId.trim() : "";
  if (compareMode) {
    for (const pkg of normalizedPackages) {
      parts.push(
        `Full extraction — ${labelById.get(pkg.package_id) ?? pkg.package_id} (${pkg.filename}):`,
        JSON.stringify(compactNormalizedPackage(pkg, { fullForms: true }), null, 0),
      );
    }
  } else if (pid) {
    const pkg = (await getNormalizedPackage(pid)) ?? normalizedPackages.find((p) => p.package_id === pid);
    if (pkg) {
      parts.push(
        `Primary package — ${labelById.get(pkg.package_id) ?? pkg.package_id}:`,
        JSON.stringify(compactNormalizedPackage(pkg, { fullForms: true }), null, 0),
      );
    }
  } else if (normalizedPackages.length === 1) {
    parts.push(
      `Full extraction — ${labelById.get(normalizedPackages[0]!.package_id) ?? "RFQ1"}:`,
      JSON.stringify(compactNormalizedPackage(normalizedPackages[0]!, { fullForms: true }), null, 0),
    );
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
    parts.push("Historical seed RFQs (samples):", JSON.stringify(seeds.slice(0, 6), null, 0));
  }

  const sid = typeof opts.sessionId === "string" ? opts.sessionId.trim() : "";
  if (sid) {
    const row = getRfqParseSession(sid);
    if (row) {
      parts.push(
        "Legacy workbook session:",
        JSON.stringify(
          {
            session_id: row.session_id,
            original_filename: row.original_filename,
            parsed: compactParsed(row.parse.parsed),
          },
          null,
          0,
        ),
      );
    }
  }

  const uploads = listRfqParseSessionSummaries().slice(0, 4);
  if (uploads.length > 0) {
    parts.push("Legacy workbook uploads:", JSON.stringify(uploads, null, 0));
  }

  return truncateContext(parts.join("\n\n"), compareMode ? 120_000 : 64_000);
}
