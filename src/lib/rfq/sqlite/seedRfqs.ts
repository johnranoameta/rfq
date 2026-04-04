import { getRfqDb } from "@/lib/rfq/sqlite/rfqDb";

export type SeedRfqProjectRow = {
  rfq_id: number;
  customer_id: number;
  customer_name: string;
  program_name: string;
  part_name: string;
  part_number: string;
  process_family: string;
  material_grade: string | null;
  annual_volume: number | null;
  sop_date: string | null;
  rfq_case_code: string | null;
  created_at: string | null;
};

/** Relational RFQs from the test-pack seed (`02_seed_data.sql`). */
export function listSeedRfqProjects(): SeedRfqProjectRow[] {
  const db = getRfqDb();
  return db
    .prepare(
      `SELECT
        p.rfq_id,
        p.customer_id,
        c.customer_name,
        p.program_name,
        p.part_name,
        p.part_number,
        p.process_family,
        p.material_grade,
        p.annual_volume,
        p.sop_date,
        p.rfq_case_code,
        p.created_at
      FROM rfq_projects p
      JOIN customers c ON c.customer_id = p.customer_id
      ORDER BY p.rfq_id ASC`,
    )
    .all() as SeedRfqProjectRow[];
}
