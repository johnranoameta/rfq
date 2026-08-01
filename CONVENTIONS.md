# Conventions

Rules for this repo. Most are enforced by `npm run lint`; the rest are
review-level expectations. **If lint disagrees with this document, lint wins —
fix the document.**

Everything here exists because the codebase already drifted the other way once.
Each rule names the drift it prevents.

---

## 1. Size limits

| Unit | Limit | Enforced by |
|---|---|---|
| File | 400 lines | `max-lines` (error) |
| Function / component | 150 lines | `max-lines-per-function` (error) |
| Cyclomatic complexity | 15 | `complexity` (error) |
| Function parameters | 4 | `max-params` (error) |

A React component that needs more than 150 lines of body is really two
components, or a component plus a hook. `RFQAgentDashboard` reached 1450 lines
and 18 pieces of state before it was split; nobody decided that, it just
accreted.

Over the limit? Split by responsibility, not by line count:

- **State that belongs together** → a hook in a `hooks/` folder next to the
  component (`useExtractPackages`, `useAnalysisStatus`).
- **A self-contained region of the tree** → its own component
  (`DashboardHeader`, `DashboardSidebar`, `DashboardCanvas`).
- **Logic with no JSX and no React** → `src/lib/`, where it can be unit-tested
  (`filterGapFindings`, `sidebarFilters`).

Passing more than 4 arguments means the parameters want to be an options
object. Grouped props objects (`nav={{...}}`, `lists={{...}}`) count as one.

## 2. Never hand-roll these

Each of the following had 15–50 copies before it was centralised. Reintroducing
a copy is a lint error, not a style opinion.

| Instead of | Use | Enforced by |
|---|---|---|
| `e instanceof Error ? e.message : "..."` | `errorMessage(e, fallback)` from `@/lib/core/errors` | review |
| `localStorage.getItem` + `JSON.parse` + try/catch | `readJsonStorage` / `writeJsonStorage` / `removeJsonStorage` from `@/lib/core/jsonStorage` | `no-restricted-syntax` |
| `NextResponse.json({ error }, { status })` | `badRequest` / `notFound` / `errorResponse` / `failureResponse` from `@/lib/http/apiResponse` | review |
| `fetch` → `res.json()` → `if (!res.ok) throw` | `fetchJson` / `fetchJsonNoStore` / `postFormJson` from `@/lib/http/fetchJson` | review |
| `useState(false)` + `setFlag(true)` in an effect | `useHydrated()` from `@/lib/react/useHydrated` | `react-hooks/set-state-in-effect` |

`NextResponse.json(data)` for a **success** payload is fine and expected — only
the error shape is centralised, because the client's `fetchJson` depends on it
being exactly `{ error: string }`.

Direct `localStorage` is still correct in three places, and they are exempt:
`app/layout.tsx` (the pre-hydration theme script), `rfqAuth.ts`, and the
theme/font providers — all store bare strings, not JSON.

## 3. Effects

`react-hooks/set-state-in-effect` is an **error**. An effect that immediately
sets state is nearly always a value that should have been derived during
render, or an external read that belongs in `useSyncExternalStore`.

Three fixes, in order of preference:

1. **Derive it.** If the value is a function of props/state, compute it in a
   `useMemo`. `useKbCatalog` picks the selected KB class this way instead of
   correcting itself in an effect afterwards.
2. **`useHydrated()`** for browser-only reads (localStorage, `matchMedia`).
   It returns `false` during SSR and hydration, `true` after, with no mismatch.
3. **Inline the `await`.** For fetch-on-mount, write the async IIFE inside the
   effect with a `cancelled` flag so it is visible that nothing is set
   synchronously.

Suppressing the rule is a last resort and needs a comment saying what breaks if
you fix it properly. There is exactly one in the tree
(`RfqKbMainPanel`, where clearing the error later would leave a stale message
on screen); match that bar.

## 4. Tests

TDD for `src/lib`: write the spec, watch it fail, then implement. Pure domain
logic is the testable seam — that is the main reason to move logic there.

- Specs live in a `__tests__/` folder beside the code, named `<module>.test.ts`.
- Test behaviour and edge cases, not line coverage. When you extract a function
  during a refactor, the test should pin the **existing** behaviour, including
  the parts that look like accidents — `filterGapFindings` has a case for a
  category containing a hyphen precisely because the old `.replace("cat-", "")`
  only stripped the first occurrence.
- Vitest runs in the `node` environment. There is no `window`; stub it with
  `vi.stubGlobal` and unstub in `afterEach`.
- No test for JSX wiring. If something is worth testing, extract it first.

## 5. Imports and naming

- `@/` is the only path alias; never `../../..`.
- Import order: node builtins → external packages → `@/` → relative → CSS.
  One blank line between groups.
- A function named `use*` must be a real hook. `react-hooks/rules-of-hooks`
  will reject a plain local helper that happens to start with "use".
- Prefer named exports. `RFQAgentDashboard` is a default export only because
  Next.js pages require it.

## 6. Comments

Comment the **why**, never the what. A comment restating the code is noise that
future readers and models both have to skip past.

Worth writing:

```ts
// Batch-upload race: when N workbooks are dropped at once every analysis fires
// this callback. Only auto-activate if nothing else is already driving the
// dashboard, so the user's open RFQ is not yanked away by a later finisher.
```

Not worth writing:

```ts
// Set the workspace mode to analysis
setWorkspaceMode("analysis");
```

Every non-obvious constant gets a doc comment with its unit or reason
(`DONE_PILL_LINGER_MS`, `STORED_NAME_DB_ONLY`).

## 7. Framework

This is **Next.js 16 / React 19**, which has breaking changes from earlier
releases. Read the relevant guide in `node_modules/next/dist/docs/` before
writing Next-specific code. Do not port patterns from memory.

- API routes are Node runtime: `export const runtime = "nodejs"`.
- Long-running analysis routes set `export const maxDuration = 120`.

## 8. Commits

Plain messages, no Claude co-author or footer. Explain what changed and why the
change is safe; a refactor commit should say how it was verified.

---

## Checklist before you finish

```
npm run lint     # 0 errors
npm test         # all green
npm run build    # exit 0 — this is also the typecheck
```

A refactor must additionally show it changed nothing: run the app
(`npm run dev`) and check the routes your change touches, including error
responses.
