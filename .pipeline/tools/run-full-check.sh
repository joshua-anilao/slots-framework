#!/usr/bin/env bash
# Full regression run used by /precommit (and by any run whose "Test scope" is FULL).
# Replaces RapidPro's Unity run-game-tests.sh. Nothing here needs Cocos Creator closed.
# Runs the parts of "npm run check" one by one so a failure names its step and the rest still run:
#   typecheck, typecheck:cocos, test (Vitest), check:cocos; with --sim also a 10M-round sim of the active variant.
# Usage: .pipeline/tools/run-full-check.sh [--sim] [--game games/game-001]
# Output: .pipeline/precommit/summary.txt and one log per step next to it.
# Exit code: 0 all passed, 1 a step failed.
set -u
cd "$(dirname "$0")/../.." || exit 1
SIM=0; GAME="games/game-001"
while [ $# -gt 0 ]; do case "$1" in --sim) SIM=1;; --game) GAME="$2"; shift;; esac; shift; done
OUT=".pipeline/precommit"; mkdir -p "$OUT"; : > "$OUT/summary.txt"
FAIL=0
step() { # name, command...
  local name="$1"; shift
  local log="$OUT/${name//:/-}.log"
  local start=$(date +%s)
  "$@" > "$log" 2>&1; local code=$?
  local secs=$(( $(date +%s) - start ))
  local line="$name: $([ $code -eq 0 ] && echo PASS || echo FAIL) (${secs}s)"
  case "$name" in
    test) line="$line $(grep -E '^\s*(Test Files|Tests)\s' "$log" | sed 's/^ *//' | paste -sd' ' -)";;
    typecheck*) [ $code -ne 0 ] && line="$line $(grep -c 'error TS' "$log") error(s), first: $(grep -m1 'error TS' "$log" | cut -c1-140)";;
  esac
  grep -q 'typecheck:cocos skipped' "$log" && line="$line [SKIPPED: no cc.d.ts, not a pass]"
  echo "$line" | tee -a "$OUT/summary.txt"
  [ $code -eq 0 ] || FAIL=1
}
step typecheck npm run typecheck
step typecheck:cocos npm run typecheck:cocos
step test npm test
step check:cocos npm run check:cocos
if [ "$SIM" = 1 ]; then
  step sim npm run sim -- "$GAME" --spins 10000000
  node -e "const s=require('./$GAME/reports/'+require('./$GAME/game.json').multiplier.variant+'/summary.json');for(const c of s.checks)console.log('  '+(c.pass?'ok  ':'FAIL')+' '+c.name+': '+c.value+' (target '+c.target+')')" | tee -a "$OUT/summary.txt"
fi
echo "$([ $FAIL -eq 0 ] && echo 'PRECOMMIT PASS' || echo 'PRECOMMIT FAIL') — summary: .pipeline/precommit/summary.txt"
exit $FAIL
