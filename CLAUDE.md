# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@CONVENTIONS.md

## Before writing code

`CONVENTIONS.md` is binding, not advisory. Read it before your first edit in a
session. The rules that matter most, because the codebase already drifted past
them once:

1. **Do not hand-roll the shared primitives.** `errorMessage`, `jsonStorage`,
   `apiResponse`, `fetchJson`, `useHydrated` exist because each replaced 15–50
   copies. Grep for an existing helper before writing error handling, a
   `localStorage` read, an API error reply, or a client fetch.
2. **Respect the size limits** (400 lines/file, 200/function, complexity 20).
   `npm run lint` enforces them as errors on new code. When you hit one, split
   by responsibility — state into a `hooks/` file, a region of the tree into a
   component, pure logic into `src/lib/` where it can be tested.
3. **`eslint.config.mjs` carries a legacy shrink-list** of files that predate
   the limits and warn instead of erroring. Never add to it.
4. **Never leave dead code.** Unused vars are an error, not a warning.

Finish with `npm run lint` (0 errors), `npm test`, and `npm run build`
(exit 0 — this is also the typecheck). For a refactor, additionally run the app
and check the routes you touched.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (use to typecheck)
npm run lint         # ESLint; must stay at 0 errors. Warnings are the legacy shrink-list (see CONVENTIONS.md § 1)
npm test             # Vitest (specs in __tests__/ folders beside the code)
npm run test:watch   # Vitest, watch mode

# Sample data generators (write to project_files/)
npm run sample-pdf
npm run sample-multi-pdf
npm run sample-gap-demo
npm run sample-workbooks

# PM2 production deployment
npm run start:pm2
npm run pm2:reload
npm run deploy:pm2   # build + pm2
```

## Conventions

Full rules in `CONVENTIONS.md`. In brief:

- TDD: test first (Vitest), watch it fail, then implement. Pure domain logic in `src/lib` is the testable seam.
- Path alias `@/` → `src/`; never `../../`.
- Shared primitives are mandatory: `@/lib/core/errors`, `@/lib/core/jsonStorage`, `@/lib/http/apiResponse`, `@/lib/http/fetchJson`, `@/lib/react/useHydrated`.
- Size limits enforced by lint: 400 lines/file, 200/function, complexity 20, 4 params.
- Commits: plain messages, no Claude co-author/footer.

## graphify (optional, per-developer)

**Check `graphify-out/graph.json` exists before using any of this.** The graph
is git-ignored and each developer builds their own, so on most checkouts it is
absent and the `graphify` CLI is not installed. If it is missing, skip this
section entirely — do not try the commands and do not offer to build it
unprompted (the first build needs an LLM API key). Setup: `GRAPHIFY.md`.

When the graph *is* present:

- Codebase questions: `graphify query "<question>"`; `graphify path "<A>" "<B>"`
  for relationships; `graphify explain "<concept>"` for focused concepts — each
  returns a scoped subgraph, smaller than GRAPH_REPORT.md or grep.
- `graphify-out/wiki/index.md` for broad navigation if present.
- `graphify-out/GRAPH_REPORT.md` only for broad architecture review.
- After code changes, `graphify update .` refreshes it (AST-only, no API cost).

## Architecture

This is **Next.js 16 with React 19** — a version with breaking API changes from earlier releases. Before writing Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`.

### Application overview

RFQ Assistant is an internal automotive procurement tool for NorthBridge Automotive. Users upload RFQ (Request for Quote) documents, the app parses them with OpenAI, matches them against a historical knowledge base, runs gap analysis (identifying missing or risky items), and produces a quote review.

### Entry points and routing

- `src/app/page.tsx` — root; wraps the dashboard in `<AuthGuard>`
- `src/app/login/page.tsx` — hardcoded credentials (`RFQ1` / `Manu1a!`) stored in `rfqAuth.ts`; auth is client-side only (localStorage flag)
- `src/app/help/page.tsx`, `src/app/baseline/page.tsx`, `src/app/extraction/page.tsx` — secondary pages

Guarded pages use `<AuthGuard fallback={…}>` from `src/components/auth/AuthGuard.tsx`,
which reads auth via `useSyncExternalStore` so there is no hydration mismatch.

### Dashboard structure

`src/components/rfq/RFQAgentDashboard.tsx` is a composition root only. Its
parts live in `src/components/rfq/dashboard/`:

| Path | What |
|---|---|
| `hooks/useRfqWorkspace` | which RFQ is loaded, the Analysis selection, the sidebar upload list |
| `hooks/useWorkspacePersistence` | prefs/cache reads and writes, module-enabled guards |
| `hooks/useActivateRfq` | loads a stored analysis, falling back to the local gap cache |
| `hooks/useEnsureWorkbookSession` | fills in case data when a selection has none |
| `hooks/useHydrateUploadList` | merges the catalog and the localStorage backup on boot |
| `hooks/useKbCatalog` | catalog fetch + KB class buckets |
| `hooks/useExtractPackages` | Word-package list, selection, delete |
| `hooks/useAnalysisStatus` | per-file pipeline status pills and dots |
| `hooks/useGapDocumentActions` | supply / remove / finalize a gap document |
| `DashboardHeader`, `DashboardSidebar`, `DashboardCanvas` | the three regions |
| `sidebar/SidebarPrimitives` | shared row, nav-button and pill components |
| `sidebar/SidebarLists` | the per-workspace list bodies |
| `sidebar/WorkspaceNav` | the nav tree |

### Workspace modes

The dashboard has five top-level modes controlled by `workspaceMode` state:

| Mode | Description |
|---|---|
| `kb` / `browse` | Knowledge Base — historical RFQ library grouped by KB class |
| `kb` / `training` | Word package extraction workspace |
| `inquiry` | AI chat over extracted Word packages |
| `analysis` | RFQ analysis: Overview, Matching, Coverage, Gap analysis, Reuse, Quote |
| `library` | Saved analyses list |
| `portfolio` | Portfolio panel (hidden unless `NEXT_PUBLIC_SHOW_PORTFOLIO=true`) |

### Data pipeline (workbook path)

1. User uploads an `.xlsx` workbook (4-sheet format: Header, Line_Items, Technical_Specs, Supplier_Responses)
2. `POST /api/rfq/upload` saves file to `uploads/` dir
3. `POST /api/rfq/analyze-uploaded-workbook` orchestrates:
   - `parseRfqWorkbook` — reads the 4 sheets
   - `workbookToAgentParsed` — normalizes to internal `ParsedRfq` shape
   - `loadHistoricalKnowledge` + `rankHistoricalMatches` — scores against SQLite KB
   - `buildGapAnalysisFromWorkbook` (heuristic) + `runOpenAiGapAnalysis` (LLM)
   - `assignKbCategoryForParsed` — classifies into a KB class slug
   - `upsertRfqParseSession` + `upsertKnowledgeBaseFromUpload` — persists to SQLite
4. Result becomes `CaseData` (type in `src/data/rfqTypes.ts`) held in dashboard React state

### Word package path (alternative)

Word `.docx` packages are extracted by a **Python engine** at `RFQ_ENGINE_ROOT` (defaults to `word-extract/` or `../word-extract/`). The Next.js app shells out via `runPythonEngine` in `src/lib/extraction/runPythonEngine.ts`. Extraction output JSON/DB files land in `RFQ_OUTPUT_DIR`.

### Database

Single SQLite file at `data/rfq.sqlite` (or `RFQ_DATABASE_PATH` env var). Accessed via `better-sqlite3` with a module-level singleton in `src/lib/rfq/sqlite/rfqDb.ts`. Schema is auto-migrated on first `getRfqDb()` call — no migration files to run manually.

Seed data is read from `project_files/RFQ_Agent_Test_Files_Pack/database/` (SQL files) on first boot.

### Key type: `CaseData`

Defined in `src/data/rfqTypes.ts`. This is the central data shape passed through most of the Analysis workspace. Key fields:
- `docs` — document checklist (`DocEntry[]`), each with `status: "ok" | "miss" | "pend"`
- `gap_findings` — `GapFinding[]` with rule code, severity, category, and action
- `gap_workflow` — per-rule workflow status (`open | in_review | resolved | accepted_risk`)
- `risk_score` — integer 0–100
- `triggered_rules` — list of fired rule codes (28 total rules)

### State persistence layers

| Layer | What |
|---|---|
| SQLite (`data/rfq.sqlite`) | Parsed sessions, KB records, match settings |
| `localStorage` / `sessionStorage` | Auth flag, sidebar list cache, workspace prefs, gap session cache |
| React state | Active `CaseData`, UI mode, filter state |

Cache helpers in `src/lib/rfq/`: `sidebarListCache.ts`, `workspacePrefsCache.ts`, `gapSessionCache.ts`.

### Environment variables

Required for workbook analysis:
- `OPENAI_API_KEY` — used for gap analysis LLM calls (GPT model via `openai` SDK)

Optional:
- `RFQ_DATABASE_PATH` — override SQLite path (default: `data/rfq.sqlite`)
- `RFQ_ENGINE_ROOT` — Python Word extraction engine root
- `RFQ_PYTHON` — Python executable name (default: `py`)
- `RFQ_OUTPUT_DIR`, `RFQ_UPLOADS_DIR` — override engine I/O dirs
- `NEXT_PUBLIC_SHOW_PORTFOLIO=true` — show Portfolio workspace module
- `NEXT_PUBLIC_SHOW_QUOTE_HISTORY=true` — show Quote & history sub-tab
- `RFQ_MATCH_W_*`, `RFQ_MATCH_T_*` — scoring weight/threshold overrides (see `matchScoringConfig.example.env`)
- `TRUSTEDPARTS_COMPANY_ID`, `TRUSTEDPARTS_API_KEY` — TrustedParts.com Inventory API credentials (free, but access requires signup + approval at trustedparts.com — see `docs/api`), used by `scripts/refresh-trustedparts-price.mjs` to populate the external side of the dual-source cost lookup (`supplier_parts` table). Not set → external price lookups return no data rather than failing.

### Styling

Tailwind CSS v4. The main dashboard uses a custom CSS layer in `src/components/rfq/rfq-assistant.css` with CSS variables (`--ra-*`) for colors/layout — not Tailwind utilities for structural layout. Radix UI primitives (`@radix-ui/react-slot`) underpin the `Button`, `Badge`, `Card`, `Table` components in `src/components/ui/`.

Theme (dark/light/system) is applied via a `beforeInteractive` script in `src/app/layout.tsx` to prevent flash. Font is stored in `localStorage` under `ui-font`; default is `oxanium`.

### Path alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).

### API routes

All routes are Node runtime (not Edge), declared with `export const runtime = "nodejs"`. Long-running analysis routes set `export const maxDuration = 120`. PDF parsing is disabled (returns 410).

Route groups:
- `/api/rfq/*` — RFQ upload, analysis, KB, historical data, settings, database CRUD
- `/api/extraction/*` — Word package upload, run, manifest, browse, historical match
- `/api/baseline/*` — Baseline RFQ object build and retrieval
