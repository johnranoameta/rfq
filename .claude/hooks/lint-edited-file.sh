#!/usr/bin/env bash
# Lints a file Claude just edited and feeds any CONVENTIONS.md violations back
# as blocking feedback, so the rules are enforced by the harness rather than by
# remembering to run lint at the end.
#
# Wired as a PostToolUse hook on Edit/Write in .claude/settings.json.
set -uo pipefail

FILE=$(python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print((d.get('tool_input') or {}).get('file_path', ''))
" 2>/dev/null) || exit 0

# Only source files under src/ are covered by the convention rules.
case "$FILE" in
  *"/src/"*.ts | *"/src/"*.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$FILE" ] || exit 0

# --format json keeps parsing independent of the pretty formatter, and lets us
# report errors only (warnings are the legacy shrink-list, not actionable here).
OUT=$(npx --no-install eslint "$FILE" --format json 2>/dev/null | python3 -c "
import json, sys
try:
    results = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for f in results:
    for m in f.get('messages', []):
        if m.get('severity') == 2:
            print(f\"  line {m.get('line')}: {m.get('message','').splitlines()[0]}  [{m.get('ruleId')}]\")
" 2>/dev/null)
[ -z "$OUT" ] && exit 0

# Exit code 2 sends stderr back to Claude as feedback to act on.
{
  echo "ESLint errors in $FILE — these are CONVENTIONS.md rules and must be fixed:"
  echo "$OUT"
  echo
  echo "See CONVENTIONS.md. Do not silence a rule with eslint-disable unless you"
  echo "state what breaks if you fix it properly."
} >&2
exit 2
