@AGENTS.md

## Project

`rfq-ui` — internal tool for analyzing manufacturing RFQs: PDF/workbook extraction, gap analysis against a historical knowledge base, and quote assistance. Next.js 16 (App Router), React 19, TypeScript, Tailwind. Server-side OpenAI calls; local SQLite store.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (use to typecheck)
- `npm test` / `npm run test:watch` — Vitest (specs in `src/lib/rfq/__tests__`)
- `npm run lint` — ESLint (repo has known pre-existing warnings; only fix new ones in files you touch)
- `npm run deploy:pm2` — build + pm2 (`ecosystem.config.cjs`)

## Layout

- `src/app/` — routes + API. `src/app/api/rfq/*` (extraction, database, historical-knowledge, kb-inquiry), `api/extraction/*`, `api/baseline/*`. Pages: `extraction`, `baseline`, `help`, `login`.
- `src/components/rfq/` — main UI. Entry: `RFQAgentDashboard.tsx`. Gap analysis: `RfqWorkbookGapsPanel.tsx`.
- `src/components/ui/` — shared primitives (shadcn-style).
- `src/lib/rfq/` — domain logic: extraction (`*Extract*`, `parseRfqWorkbook`), gap engine (`reconcileGapsWithDocuments`, `gapFrom*`, `applySuppliedPackageDoc`), knowledge base (`kb*`, `historicalKnowledge*`), OpenAI (`openai*`).
- `src/lib/rfq/sqlite/` — DB layer (`rfqDb.ts`, `historicalKnowledgeDb.ts`). Store: `data/rfq.sqlite` (better-sqlite3).
- `src/data/rfqTypes.ts` — core types (`CaseData`, `DocEntry`, `GapFinding`, etc.). Read before touching domain logic.
- `src/components/auth/rfqAuth.ts` — auth.

## Conventions

- TDD: test first (Vitest), watch it fail, then implement. Pure domain logic in `src/lib/rfq` is the testable seam.
- Path alias `@/` → `src/`.
- Next.js here has breaking changes vs training data — consult `node_modules/next/dist/docs/` (see AGENTS.md).
- Commits: plain messages, no Claude co-author/footer.

## graphify

Knowledge graph at `graphify-out/` (god nodes, community structure, cross-file relationships).

- Codebase questions: run `graphify query "<question>"` when `graphify-out/graph.json` exists. `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for focused concepts — return scoped subgraphs, smaller than GRAPH_REPORT.md or grep.
- `graphify-out/wiki/index.md` for broad navigation if present.
- `graphify-out/GRAPH_REPORT.md` only for broad architecture review.
- After code changes, run `graphify update .` to keep the graph current (AST-only, no API cost).
