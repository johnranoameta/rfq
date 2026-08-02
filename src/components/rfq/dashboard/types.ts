import type { KbCategoryRow } from "@/lib/rfq/sqlite/kbCategories";
import type { RfqParseSessionRow } from "@/lib/rfq/sqlite/parseSessions";

/** Top-level workspace selected in the sidebar. */
export type WorkspaceMode =
  | "kb"
  | "inquiry"
  | "analysis"
  | "library"
  | "portfolio"
  | "supplierdb";

/** Sub-mode within the Knowledge Base workspace. */
export type KbSubMode = "browse" | "training";

/** Active filter on the Gap analysis list. */
export type GapFilterKey =
  | "all"
  | "finalized"
  | "sev-critical"
  | "sev-high"
  | "sev-medium"
  | "sev-low"
  | `cat-${string}`;

/** Response shape of `GET /api/rfq/database/catalog`. */
export type CatalogPayload = {
  upload_analyses?: RfqParseSessionRow[];
  historical_uploads?: { project_id?: string }[];
  seed_projects?: Array<{
    rfq_id: number;
    customer_id?: number;
    customer_name: string;
    program_name: string;
    part_name: string;
    part_number: string;
    process_family: string;
    material_grade: string | null;
    annual_volume: number | null;
    sop_date: string | null;
    rfq_case_code: string | null;
    created_at?: string | null;
    kb_category_slug?: string | null;
  }>;
  kb_categories?: KbCategoryRow[];
  error?: string;
};
