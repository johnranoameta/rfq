# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (use to typecheck)
npm run lint         # ESLint check (repo has known pre-existing warnings; only fix new ones in files you touch)
npm test             # Vitest (specs in src/lib/rfq/__tests__)
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

- TDD: test first (Vitest), watch it fail, then implement. Pure domain logic in `src/lib/rfq` is the testable seam.
- Path alias `@/` → `src/`.
- Commits: plain messages, no Claude co-author/footer.

## graphify
Setup: see `GRAPHIFY.md`.

Knowledge graph at `graphify-out/` (god nodes, community structure, cross-file relationships).

- Codebase questions: run `graphify query "<question>"` when `graphify-out/graph.json` exists. `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for focused concepts — return scoped subgraphs, smaller than GRAPH_REPORT.md or grep.
- `graphify-out/wiki/index.md` for broad navigation if present.
- `graphify-out/GRAPH_REPORT.md` only for broad architecture review.
- After code changes, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Architecture

This is **Next.js 16 with React 19** — a version with breaking API changes from earlier releases. Before writing Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`.

### Application overview

RFQ Assistant is an internal automotive procurement tool for NorthBridge Automotive. Users upload RFQ (Request for Quote) documents, the app parses them with OpenAI, matches them against a historical knowledge base, runs gap analysis (identifying missing or risky items), and produces a quote review.

### Entry points and routing

- `src/app/page.tsx` — root; checks `localStorage`/`sessionStorage` auth, redirects to `/login` if not authenticated
- `src/app/login/page.tsx` — hardcoded credentials (`RFQ1` / `Manu1a!`) stored in `rfqAuth.ts`; auth is client-side only (localStorage flag)
- `src/app/help/page.tsx`, `src/app/baseline/page.tsx`, `src/app/extraction/page.tsx` — secondary pages

The entire main UI lives in one large component: `src/components/rfq/RFQAgentDashboard.tsx`.

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
