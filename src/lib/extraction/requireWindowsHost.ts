/** Word-package extraction uses Microsoft Word/Excel COM (Windows only). */

export const WINDOWS_EXTRACTION_MESSAGE =
  "Word RFQ extraction requires Windows Server with Microsoft Word and Excel installed. " +
  "Amazon Linux EC2 cannot run this engine. See docs/ec2-word-extraction.md.";

export function isWindowsExtractionHost(): boolean {
  return process.platform === "win32";
}

export function windowsExtractionErrorResponse(): {
  error: string;
  detail: string;
  doc: string;
} {
  return {
    error: "Word extraction requires Windows Server",
    detail: WINDOWS_EXTRACTION_MESSAGE,
    doc: "docs/ec2-word-extraction.md",
  };
}
