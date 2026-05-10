/** Stable key for comparing category labels (punctuation/spacing insensitive). */
export function normalizedKbLabelKey(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "");
}
