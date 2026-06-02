export type ExpectedFileSlot = {
  icon_label: string | null;
  inline_index: number | null;
  expected: boolean;
  present: boolean;
  filename: string | null;
  file_type: string | null;
  document_role: string | null;
  clean_text: string;
  char_count: number;
  error: string | null;
};

export type SectionFieldRow = {
  field: string;
  value: string;
};

export type SectionSlotRow = {
  section_number: string;
  section_title: string | null;
  section_display: string | null;
  section_path: string | null;
  status: string;
  body_text: string;
  body_char_count: number;
  expected_files: ExpectedFileSlot[];
  fields?: SectionFieldRow[];
};

export type NormalizedPackage = {
  package_id: string;
  filename: string;
  rfq_number: string | null;
  title: string | null;
  normalized_at: string | null;
  summary: Record<string, unknown>;
  section_slots: SectionSlotRow[];
};
