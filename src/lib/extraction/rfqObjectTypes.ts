export type RfqObjectField = {
  field_key: string;
  field_name: string;
  category: string;
  value: string;
  source_document: string;
  source_document_role: string;
  source_section: string;
  source_location: string;
  extraction_method: string;
  template_required: boolean;
  description: string;
  sort_order: number;
};

export type RfqObjectPackage = {
  package_id: string;
  source_path: string | null;
  filename: string;
  rfq_number: string | null;
  title: string | null;
  is_baseline: boolean;
  catalog_version: string;
  built_at: string;
  field_count: number;
  filled_field_count: number;
  summary: {
    categories?: string[];
    attachment_registry_count?: number;
    requirement_count?: number;
  };
  fields: RfqObjectField[];
};

export const FIELD_CATEGORIES = [
  "identity",
  "part",
  "schedule",
  "process",
  "contacts",
  "access",
  "form.quote_ack",
  "form.supplier_request",
  "form.cost",
  "form.tooling",
  "attachment",
  "requirement",
] as const;

export function getBaselinePackage(objects: RfqObjectPackage[]): RfqObjectPackage | null {
  return objects.find((p) => p.is_baseline) ?? objects[0] ?? null;
}
