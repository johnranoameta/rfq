import type { ItemHistoricalComparison } from "@/data/rfqTypes";
import type { RankedHistoricalMatch } from "@/lib/rfq/loadHistoricalKnowledge";

type CompactMatchRow = ItemHistoricalComparison["matches"][number];

/** Slim match rows for dashboard / Training UI (same shape as persisted workbook sessions). */
export function compactRankedMatches(matches: RankedHistoricalMatch[]): CompactMatchRow[] {
  return matches.map((m) => ({
    project_id: m.project_id,
    score: m.score,
    similarity_0_1: m.similarity_0_1,
    exact_part_number: m.exact_part_number,
    reasons: m.reasons,
    record: {
      rfq: {
        part_name: m.record.rfq.part_name,
        part_number: m.record.rfq.part_number,
        material: m.record.rfq.material,
        process: m.record.rfq.process,
      },
      quote_result: {
        quoted_piece_price_usd: m.record.quote_result.quoted_piece_price_usd,
      },
    },
  }));
}
