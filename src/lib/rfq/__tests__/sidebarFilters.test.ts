import { describe, expect, it } from "vitest";

import {
  kbBucketMatchesQuery,
  normalizeSidebarQuery,
  uploadMatchesQuery,
  wordPackageMatchesQuery,
} from "@/components/rfq/dashboard/sidebarFilters";
import type { ExtractPackageSummary } from "@/components/extraction/RfqWordExtractWorkspace";
import type { UploadedPackageFile } from "@/components/rfq/RfqPackageUpload";
import type { KbBucket } from "@/lib/rfq/kbBucketPartition";

const upload = (originalName: string) =>
  ({ id: "1", originalName, size: 0, mimeType: "x", storedName: "s" }) as UploadedPackageFile;

const pkg = (over: Partial<ExtractPackageSummary>) =>
  ({
    key: "k",
    filename: "RFQ1.docx",
    rfq_number: null,
    title: null,
    section_count: 0,
    attachment_count: 0,
    has_error: false,
    ...over,
  }) as ExtractPackageSummary;

const bucket = (over: Partial<KbBucket>) =>
  ({ slug: "s", label: "Stamping Parts", projects: [], ...over }) as unknown as KbBucket;

const project = (over: Record<string, unknown>) =>
  ({
    part_name: "Bracket",
    program_name: "EV Crossover",
    part_number: "NB-SS-1101",
    ...over,
  }) as never;

describe("normalizeSidebarQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeSidebarQuery("  BrAcKeT  ")).toBe("bracket");
  });

  it("collapses a whitespace-only query to empty", () => {
    expect(normalizeSidebarQuery("   ")).toBe("");
  });
});

describe("uploadMatchesQuery", () => {
  it("matches everything on an empty query", () => {
    expect(uploadMatchesQuery(upload("anything.xlsx"), "")).toBe(true);
  });

  it("matches a case-insensitive substring of the filename", () => {
    expect(uploadMatchesQuery(upload("RFQ-STMP-CLP-001.xlsx"), "stmp")).toBe(true);
  });

  it("rejects a non-match", () => {
    expect(uploadMatchesQuery(upload("RFQ-STMP-CLP-001.xlsx"), "mach")).toBe(false);
  });
});

describe("wordPackageMatchesQuery", () => {
  it("matches on filename, rfq_number or title", () => {
    expect(wordPackageMatchesQuery(pkg({ filename: "Alpha.docx" }), "alpha")).toBe(true);
    expect(wordPackageMatchesQuery(pkg({ rfq_number: "RFQ-77" }), "rfq-77")).toBe(true);
    expect(wordPackageMatchesQuery(pkg({ title: "Seat Frame" }), "seat")).toBe(true);
  });

  it("tolerates null rfq_number and title", () => {
    expect(wordPackageMatchesQuery(pkg({ rfq_number: null, title: null }), "zzz")).toBe(false);
  });
});

describe("kbBucketMatchesQuery", () => {
  it("matches the class label", () => {
    expect(kbBucketMatchesQuery(bucket({}), "stamping")).toBe(true);
  });

  it("matches a contained project's part name, program or part number", () => {
    const b = bucket({ label: "Other", projects: [project({})] });
    expect(kbBucketMatchesQuery(b, "bracket")).toBe(true);
    expect(kbBucketMatchesQuery(b, "crossover")).toBe(true);
    expect(kbBucketMatchesQuery(b, "nb-ss-1101")).toBe(true);
  });

  it("rejects when neither the label nor any project matches", () => {
    expect(kbBucketMatchesQuery(bucket({ label: "Other", projects: [project({})] }), "zzz")).toBe(
      false,
    );
  });

  it("matches an empty bucket on an empty query", () => {
    expect(kbBucketMatchesQuery(bucket({ projects: [] }), "")).toBe(true);
  });
});
