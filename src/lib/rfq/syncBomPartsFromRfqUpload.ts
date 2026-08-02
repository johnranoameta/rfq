import { looksLikeBomPartsRfqUpload } from "@/lib/rfq/parseBomPartsAsRfqWorkbook";
import { looksLikeAagSingleSheetQuote, parseAagSingleSheetQuote } from "@/lib/rfq/parseAagSingleSheetQuote";
import { parseBomPartsWorkbook } from "@/lib/rfq/parseBomPartsWorkbook";
import { listBomParts, replaceBomParts } from "@/lib/rfq/sqlite/bomPartsDb";

/**
 * When an uploaded RFQ workbook is actually BOM-parts-shaped (README/suppliers/parts,
 * or the AAG single-sheet quote shape), also populates bom_parts for this RFQ so BOM
 * Intelligence and Costing agent show the same parts under the same rfq_file_id — one
 * upload, consistent data across every tab. No-op for the strict 4-sheet RFQ shape.
 *
 * Only syncs on the FIRST upload for a given rfqFileId: once bom_parts rows exist,
 * they may include BOM Intelligence inline edits, so a later re-analysis of the same
 * RFQ must not silently overwrite them.
 */
export function maybeSyncBomPartsFromRfqUpload(buffer: Buffer, rfqFileId: string): void {
  const isBomPartsShape = looksLikeBomPartsRfqUpload(buffer);
  const isAagShape = !isBomPartsShape && looksLikeAagSingleSheetQuote(buffer);
  if (!isBomPartsShape && !isAagShape) return;
  if (listBomParts(rfqFileId).length > 0) return;

  if (isBomPartsShape) {
    const { rows } = parseBomPartsWorkbook(buffer);
    replaceBomParts(rfqFileId, rows);
  } else {
    const { bomPartsRows } = parseAagSingleSheetQuote(buffer);
    replaceBomParts(rfqFileId, bomPartsRows);
  }
}
