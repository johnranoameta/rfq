import type { ExpectedFileSlot, NormalizedPackage, SectionSlotRow } from "@/lib/extraction/normalizedTypes";

export type RfqPackageLabel = {
  rfq_label: string;
  package_id: string;
  filename: string;
  rfq_number: string | null;
};

/** Stable RFQ1 / RFQ2 labels for chat (sorted by package_id). */
export function labelPackages(packages: NormalizedPackage[]): RfqPackageLabel[] {
  const sorted = [...packages].sort((a, b) => a.package_id.localeCompare(b.package_id));
  return sorted.map((p, i) => ({
    rfq_label: `RFQ${i + 1}`,
    package_id: p.package_id,
    filename: p.filename,
    rfq_number: p.rfq_number,
  }));
}

function isSupplierOrFormSection(slot: SectionSlotRow): boolean {
  const hay = `${slot.section_number} ${slot.section_display ?? ""} ${slot.section_title ?? ""}`.toLowerCase();
  return (
    hay.includes("supplier") ||
    hay.includes("request form") ||
    hay.includes("commercial") ||
    slot.section_number === "1.3" ||
    slot.section_number.startsWith("1.3")
  );
}

function meaningfulFields(slot: SectionSlotRow): { field: string; value: string }[] {
  return (slot.fields ?? []).filter((f) => {
    const v = (f.value ?? "").trim();
    if (!v) return false;
    if (/^_+$/.test(v)) return false;
    if (f.field.startsWith("attachment ·") && (v === "present" || !v)) return false;
    return true;
  });
}

function formAttachmentText(files: ExpectedFileSlot[]): Array<{ filename: string | null; role: string | null; text: string }> {
  return files
    .filter((f) => f.present && (f.clean_text ?? "").trim().length > 0)
    .map((f) => ({
      filename: f.filename,
      role: f.document_role,
      text: (f.clean_text ?? "").slice(0, 12_000),
    }));
}

/** Compact per-package digest for cross-RFQ comparison (forms, fields, attachment text). */
export function buildPackageComparisonDigest(pkg: NormalizedPackage, rfqLabel: string): Record<string, unknown> {
  const sections: Record<string, unknown>[] = [];

  for (const slot of pkg.section_slots ?? []) {
    const fields = meaningfulFields(slot);
    const forms = formAttachmentText(slot.expected_files ?? []);
    const hasBody = (slot.body_text ?? "").trim().length > 0;

    if (!fields.length && !forms.length && !hasBody) continue;

    const entry: Record<string, unknown> = {
      section_number: slot.section_number,
      section_display: slot.section_display ?? slot.section_title,
      status: slot.status,
    };

    if (fields.length) entry.fields = fields;
    if (forms.length) entry.attachment_forms = forms;
    if (hasBody) entry.body_text = (slot.body_text ?? "").slice(0, 4000);

    sections.push(entry);
  }

  const supplierSections = (pkg.section_slots ?? []).filter(isSupplierOrFormSection).map((slot) => ({
    section_number: slot.section_number,
    section_display: slot.section_display ?? slot.section_title,
    fields: meaningfulFields(slot),
    attachment_forms: formAttachmentText(slot.expected_files ?? []),
    body_text: (slot.body_text ?? "").slice(0, 6000),
  }));

  return {
    rfq_label: rfqLabel,
    package_id: pkg.package_id,
    filename: pkg.filename,
    rfq_number: pkg.rfq_number,
    supplier_and_commercial_sections: supplierSections,
    all_sections_with_data: sections,
  };
}

export function wantsRfqComparison(messages: { role: string; content: string }[]): boolean {
  const text = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content.toLowerCase())
    .join(" ");
  return /\b(compare|comparison|difference|differences|diff|versus|vs\.?|between|rfq\s*1|rfq\s*2|rfq1|rfq2)\b/.test(
    text,
  );
}
