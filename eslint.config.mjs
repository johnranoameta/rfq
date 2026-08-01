import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Rules that machine-enforce CONVENTIONS.md.
 *
 * Only the mechanically checkable rules live here; the rest of the document is
 * review-level. If a rule here and the document disagree, this file wins.
 */
const conventions = {
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    // § 1 Size limits. Blank lines and comments do not count toward the budget,
    // so documenting code is never what pushes a file over.
    "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
    "max-lines-per-function": [
      "error",
      { max: 200, skipBlankLines: true, skipComments: true, IIFEs: false },
    ],
    complexity: ["error", 20],
    "max-params": ["error", 4],

    // § 2 Unused code is deleted, not left behind. This was only a warning
    // while ~590 dead lines accumulated in the dashboard.
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],

    // § 2 Raw JSON localStorage access. Use @/lib/core/jsonStorage, which owns
    // the SSR guard, the parse failure and the quota failure.
    "no-restricted-syntax": [
      "error",
      {
        selector:
          "CallExpression[callee.object.name='localStorage'][callee.property.name=/^(getItem|setItem|removeItem)$/]",
        message:
          "Use readJsonStorage/writeJsonStorage/removeJsonStorage from @/lib/core/jsonStorage instead of localStorage directly (CONVENTIONS.md § 2).",
      },
      {
        selector:
          "CallExpression[callee.object.property.name='localStorage'][callee.property.name=/^(getItem|setItem|removeItem)$/]",
        message:
          "Use readJsonStorage/writeJsonStorage/removeJsonStorage from @/lib/core/jsonStorage instead of window.localStorage directly (CONVENTIONS.md § 2).",
      },
    ],

    // § 5 Deep relative traversal; `@/` is the only alias.
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["../../*"],
            message: "Import via the @/ alias instead of ../../ (CONVENTIONS.md § 5).",
          },
        ],
      },
    ],
  },
};

/**
 * Files that predate the size limits, downgraded to warnings so the build stays
 * green while new code is held to the rule. This is a ratchet: entries come off
 * the list as files are split, and nothing may be added to it.
 *
 * Splitting one of these is a standalone refactor — see CONVENTIONS.md § 1 for
 * how (`RFQAgentDashboard` went 2152 -> 255 lines that way).
 */
const legacyOversizedFiles = [
  "src/app/api/extraction/run/route.ts",
  "src/app/api/rfq/analyze-uploaded-workbook/route.ts",
  "src/app/api/rfq/kb-inquiry/route.ts",
  "src/components/baseline/BaselineRfqObjectPanel.tsx",
  "src/components/extraction/RfqWordExtractWorkspace.tsx",
  "src/components/help/HelpManual.tsx",
  "src/components/rfq/AllRfqsLibrary.tsx",
  "src/components/rfq/RfqAnalysisShell.tsx",
  "src/components/rfq/RfqPackageUpload.tsx",
  "src/components/rfq/RfqPortfolioPanel.tsx",
  "src/components/rfq/RfqReferenceMatchPanel.tsx",
  "src/components/rfq/RfqSupplierPartsPanel.tsx",
  "src/components/rfq/RfqWorkbookCostingPanel.tsx",
  "src/components/rfq/RfqWorkbookGapsPanel.tsx",
  "src/components/rfq/RfqWorkbookSummaryPanel.tsx",
  "src/components/settings/SettingsMenu.tsx",
  "src/data/sampleRfqPipeline.ts",
  "src/lib/rfq/applySuppliedPackageDoc.ts",
  "src/lib/rfq/buildKbRecordFromParsed.ts",
  "src/lib/rfq/caseFromPersisted.ts",
  "src/lib/rfq/costLookupSelection.ts",
  "src/lib/rfq/gapFromWorkbook.ts",
  "src/lib/rfq/gapSessionCache.ts",
  "src/lib/rfq/kbInquiryContext.ts",
  "src/lib/rfq/loadHistoricalKnowledge.ts",
  "src/lib/rfq/mapParsedToMatch.ts",
  "src/lib/rfq/reconcileGapsWithDocuments.ts",
];

/** Exemptions, each with a reason. Adding one is a deliberate act. */
const conventionExemptions = [
  {
    // PM2 loads this as CommonJS, so `require` is the correct form here.
    files: ["ecosystem.config.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // These store bare strings, not JSON, so jsonStorage does not apply.
    files: [
      "src/components/auth/rfqAuth.ts",
      "src/components/theme/ThemeProvider.tsx",
      "src/components/settings/FontProvider.tsx",
      "src/app/layout.tsx",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // This module *is* the localStorage wrapper the rule points at.
    files: ["src/lib/core/jsonStorage.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Specs are long by nature and stub globals deliberately.
    files: ["src/**/__tests__/**"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    files: legacyOversizedFiles,
    rules: {
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "warn",
        { max: 200, skipBlankLines: true, skipComments: true, IIFEs: false },
      ],
      complexity: ["warn", 20],
      "max-params": ["warn", 4],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  conventions,
  ...conventionExemptions,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
