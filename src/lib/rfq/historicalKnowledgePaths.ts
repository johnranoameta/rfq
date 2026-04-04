import path from "path";

/** Test-pack historical corpus (JSONL + CSV). */
export function getHistoricalDataDir(): string {
  return path.join(
    process.cwd(),
    "project_files",
    "RFQ_Agent_Test_Files_Pack",
    "historical_data",
  );
}
