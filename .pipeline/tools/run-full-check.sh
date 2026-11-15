#!/usr/bin/env bash
# Full regression run used by /precommit (and by any run whose "Test scope" is FULL).
# Replaces RapidPro's Unity run-game-tests.sh. Nothing here needs Cocos Creator closed.
#   1. npm run check   typecheck, Cocos typecheck, every Vitest test, shared/ copy is fresh
#   2. --sim           also a 10M-round sim of the active variant (minutes; use when math changed)
# Usage: .pipeline/tools/run-full-check.sh [--sim] [--game games/game-001]
# Output: .pipeline/precommit/summary.txt and the raw logs next to it.
# Exit code: 0 all passed, 1 a check failed.
set -u
cd "$(dirname "$0")/../.." || exit 1
SIM=0; GAME="games/game-001"
while [ $# -gt 0 ]; do case "$1" in --sim) SIM=1;; --game) GAME="$2"; shift;; esac; shift; done
OUT=".pipeline/precommit"; mkdir -p "$OUT"; : > "$OUT/summary.txt"
FAIL=0
step() { # name, command...
  local name="$1"; shift
  local start=$(date +%s)
  "$@" > "$OUT/$name.log" 2>&1; local code=$?
  local secs=$(( $(date +%s) - start ))
  local line="$name: $([ $code -eq 0 ] && echo PASS || echo FAIL) (${secs}s)"
  [ "$name" = check ] && line="$line $(grep -E '^\s*Tests\s' "$OUT/check.log" | tail -1 | sed 's/^ *//')"
  grep -q 'typecheck:cocos skipped' "$OUT/$name.log" && line="$line [typecheck:cocos SKIPPED: no cc.d.ts]"
  echo "$line" | tee -a "$OUT/summary.txt"
  [ $code -eq 0 ] || FAIL=1
}
step check npm run check
if [ "$SIM" = 1 ]; then
  step sim npm run sim -- "$GAME" --spins 10000000
  node -e "const s=require('./$GAME/reports/'+require('./$GAME/game.json').multiplier.variant+'/summary.json');for(const c of s.checks)console.log('  '+(c.pass?'ok  ':'FAIL')+' '+c.name+': '+c.value+' (target '+c.target+')')" | tee -a "$OUT/summary.txt"
fi
echo "Summary: .pipeline/precommit/summary.txt"
exit $FAIL
