import { looksLikeBomPartsRfqUpload } from "@/lib/rfq/parseBomPartsAsRfqWorkbook";
import { parseBomPartsWorkbook } from "@/lib/rfq/parseBomPartsWorkbook";
import { replaceBomParts } from "@/lib/rfq/sqlite/bomPartsDb";

/**
 * When an uploaded RFQ workbook is actually BOM-parts-shaped (README/suppliers/parts),
 * also populates bom_parts for this RFQ so BOM Intelligence and Costing agent show the
 * same parts under the same rfq_file_id — one upload, consistent data across every tab.
 * No-op for the strict 4-sheet RFQ shape.
 */
export function maybeSyncBomPartsFromRfqUpload(buffer: Buffer, rfqFileId: string): void {
  if (!looksLikeBomPartsRfqUpload(buffer)) return;
  const { rows } = parseBomPartsWorkbook(buffer);
  replaceBomParts(rfqFileId, rows);
}
