---
description: Code pipeline — planner → coder → tester → reviewer, with up to 2 fix loops
argument-hint: <feature request, as vague as you like>
---
Run the code pipeline for this request:

$ARGUMENTS

Follow `.pipeline/PIPELINE.md` for logging, gates and the final message. `P` = `node .pipeline/tools/pipeline.mjs`.

1. `P start --type feature --title "<short title>" --request "<request>"`. Note the `RUN_ID` and pass `--run <RUN_ID>` to every later `P` command.
   - If it prints a WARNING about another active run in this window, tell the person in one line that logs will mix and suggest a second Claude Code window for parallel work, then continue.
   - If the request asks for a **variant**, follow "Variants" in `PIPELINE.md` (list the registry for the planner, register the variant after PASS).
   - If the request starts with `experiment:`, follow "Experiment runs" in `PIPELINE.md` (lighter spec, toggle off by default, related tests only).
   - If the request starts with `play-first:`, use the **play-first lane** at the end of this file: start with `--lane play-first` and stop after the coder. No `play-first:` prefix means the normal full lane below, which is the right one for big or risky features.
2. **planner** → writes `01-spec.md`. If it lists **Blocking** open questions, open a gate, ask the person, add their answers to the end of `01-spec.md` under "Answers", then continue.
3. **coder** → reads the spec, writes code and `02-implementation.md`.
4. **tester** → writes and runs tests, writes `03-tests.md`. Note its `TESTS:` line.
4b. Test scope: follow the `Test scope:` line in `01-spec.md` (see `PIPELINE.md` "Full suite"). `RELATED` = typecheck plus the listed test files. `FULL` = `npm run check`. If the coder's `changes.json` is wider than the spec assumed (math-core or a shared interface touched), upgrade to `FULL` and tell Josh in one line.
4c. Math gate: if `changes.json` touches `packages/math-core`, `game.json` or `strip-weights.json`, `03-tests.md` must hold a passing 10M sim (see `PIPELINE.md` "Math gate"). If the tester did not run it, run the tester again for the sim only before the reviewer.
5. `P diff` to save `changes.diff`, then **reviewer** (read-only) → save its reply as `04-review.md`.
6. If the verdict is `CHANGES_NEEDED` and fewer than 2 fix loops have run:
   - `P stage --name coder --status running --loop <n>`, launch **coder** with "fix loop <n>: fix every Must-fix item in 04-review.md (only those), then typecheck, run the related test files yourself (and `sync:cocos` if a package changed) and add `TESTS: <passed>/<total>` to `02-implementation.md`".
   - Run **tester** again only if a Must-fix item is about missing or wrong tests; otherwise log `P stage --name tester --status skipped --note "coder re-ran tests in fix loop"`. (A full Tester pass in a fix loop roughly doubles its time.)
   - `P diff`, then **reviewer** again with "fix loop <n>: check only that each Must-fix item in 04-review.md is resolved and nothing new broke" (save as `04-review-loop<n>.md`, keep the old one).
   - After 2 loops still failing: stop, `P finish --status failed`, and hand the person the open Must-fix list.
7. On `PASS`: run `P diff` once more if code changed after the last one, then `P finish --status done --summary "<what was built>"` and give the final message from `PIPELINE.md`: the reviewer's suggested commit message and the file list from `changes.json` (these are exactly the files this run changed, Cocos `.meta` and regenerated `client-cocos/assets/shared/` included). Update `docs/FEATURES.md` (see "Feature registry"), add a short "Play check" list (Creator Preview `http://localhost:7456/?debug` or the prototype), list the reviewer's Should-fix items as ready `/iterate` lines (not applied in this run), name any `outside` files from `changes.json`, and remind the person to commit if earlier runs are uncommitted. End with: "To change this further: `/iterate <RUN_ID> <what to change>`".

## Play-first lane (`/feature play-first: <request>`)
For features where you need to see and hear it before testing is worth the time (feel, visuals, timing). Same planner and coder, but the tester and reviewer wait until you are happy. Big or risky features should use the normal lane above.

1. `P start --type feature --lane play-first --title "<short title>" --request "<request>"` (strip the `play-first:` prefix from the request).
2. **planner** → a half-page spec, every open question Non-blocking with a default, and no `Test scope:` line. Say in the prompt: "play-first lane: keep the spec to half a page; the tester runs later in /feature-qa".
3. **coder** → as normal, plus: "play-first lane: typecheck with zero errors and run only the existing test files that cover files you changed (always `tools/engineCompat.test.ts` if code reaches `client-cocos`). Do not write new tests; the QA pass does that. Add any new tunable to `docs/TUNING.md`. Creator is open: it recompiles your `.ts` edits itself."
   - A play-first run must not change math (math-core, `game.json` math, strips). If the spec does, switch it to the normal lane and tell Josh in one line.
4. `P stage --name tester --status skipped --note "play-first: QA pending"` and the same for `reviewer`. Run `P diff` so `changes.json` is saved.
5. `P finish --status done --summary "<what was built> (play-first, not tested or reviewed)"`. Add or update the row in `docs/FEATURES.md` as `Trying`, and add "(QA pending)" to the Run column.
6. Final message (short): what was built, files from `changes.json`, a "Play check" list (what to look at in Creator Preview or the prototype, which speed and seed), "Values you can tune yourself" from `docs/TUNING.md`, and: "Not tested or reviewed yet. Play it, then: `/iterate <RUN_ID> <change>` for tweaks (coder only), or `/feature-qa <RUN_ID>` when you are happy."
