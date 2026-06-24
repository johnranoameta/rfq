# graphify setup

[graphify](https://pypi.org/project/graphifyy/) builds a knowledge graph of this codebase so agents can answer structural questions from a scoped subgraph instead of grepping raw files. Graph lives in `graphify-out/` (git-ignored — each dev builds their own).

## 1. Install the CLI

```bash
uv tool install graphifyy      # binary is `graphify`
# or: pipx install graphifyy
graphify --help
```

## 2. Set an LLM backend key (first build only)

Semantic extraction needs one API key. Pick a backend and export its key:

```bash
export GEMINI_API_KEY=...      # or GOOGLE_API_KEY (recommended, cheapest)
# also supported: OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, or local Ollama
```

`update` (AST-only refresh) needs no key — only the first full `extract` does.

## 3. Build the graph

```bash
graphify extract .             # full build (AST + semantic LLM) → graphify-out/
```

Tune if needed: `--backend gemini|openai|claude|deepseek|ollama`, `--model M`, `--max-concurrency 1` for local LLMs.

## 4. Wire up your agent (one-time)

The Claude Code config is already committed (`CLAUDE.md` graphify section + `.claude/settings.json` PreToolUse hook). To (re)generate it or set up another tool:

```bash
graphify claude install        # CLAUDE.md section + PreToolUse hook
graphify codex install         # AGENTS.md (Codex / Cursor: `cursor install`, etc.)
```

Optional — auto-refresh graph on commit/checkout:

```bash
graphify hook install          # git post-commit / post-checkout hooks
graphify hook status
```

## 5. Daily use

```bash
graphify query "how are gaps reconciled with documents?"   # scoped subgraph answer
graphify path "RFQAgentDashboard" "reconcileGapsWithDocuments"   # relationship
graphify explain "isGapFinalized"                          # node + neighbors
graphify update .              # refresh after code changes (AST-only, no API cost)
```

Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review; prefer `query`/`path`/`explain` for focused questions.
