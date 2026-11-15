---
description: Test and review a whole feature once (tester → reviewer) after you have played it. Use after a play-first run and its /iterate tweaks.
argument-hint: <run id, or a few words of the feature's title>
---
QA pass for an earlier feature:

$ARGUMENTS

Follow `.pipeline/PIPELINE.md`. `P` = `node .pipeline/tools/pipeline.mjs`. You are the conductor; never leave the run idle.

1. **Find the feature.** The argument is a run id or words from a title. `P list` shows runs; take the newest matching `feature` run and read its `run.json` for `root`. The **chain** is every run whose `root` is the same (the first run plus its `/iterate` versions), in order. List which ones show `[QA pending]`. If none is pending, say the feature already had its QA and stop, unless the person asked to run it again. If several features match, ask once with the candidates.
2. **Nothing to free.** Tests and the sim run in Node, so Cocos Creator can stay open. Run `npm run check:cocos` first: if `shared/` is stale, run `npm run sync:cocos` and note it.
3. **Start.** `P start --type feature --title "<feature> QA" --request "QA of <chain run ids>"`. Log `P stage --name planner --status skipped --note "QA run: the chain's specs are the spec"` and the same for `coder` (it only runs in fix loops).
4. **Scope.** Read the chain's `01-spec.md` files and `changes.json` files. `Test scope: FULL` if any chain run touched `packages/math-core`, a shared interface, service, event, state machine or config used by many features, or the person asked for a full test; otherwise `RELATED` (list the related test files from the changed files). Say which and why in one line.
5. **tester** → "QA run for a feature built in the play-first lane. Run folder: `<RUN_DIR>`. Chain: `<run folders>`. Read every `01-spec.md`, `02-implementation.md` and `changes.json` in the chain (later runs are deltas; the final behaviour is the parents plus the deltas). Write tests for the whole feature: game-logic and math-core first (seeded RNG), plus pacing checks against `pace.ts` values where the logic exposes them. Cocos views are not unit tested: put what needs eyes or ears in the Play check list. If any chain run changed math, run the 10M sim (see `PIPELINE.md` "Math gate"). Test scope: `<FULL|RELATED>`. Write `03-tests.md` with a `TESTS:` line."
6. `P diff --since <any run id of the chain>` writes `changes.diff` and `changes.json` for the **whole feature** (from before the first run, limited to the files the chain and this QA run changed). Files other runs also edited show their changes too; the reviewer should judge the feature's code only.
7. **reviewer** → "QA review of a whole feature. Read the chain's specs and implementation notes, `03-tests.md`, and `changes.diff`. Judge the final behaviour against the specs, the rules in `docs/agents/project.md` and the programming guide, check the tests are meaningful, and return a verdict (PASS or CHANGES_NEEDED), Must-fix and Should-fix lists, and a suggested commit message for the whole feature." Save it as `04-review.md`.
8. **Fix loops** as in `/feature` step 6 (max 2). After a fix loop that touched visuals, sounds or timing, tell the person to play that part again.
9. On `PASS`: `P diff --since <chain run id>` once more if code changed, then `P qa --run <id> --status done` for **every** run in the chain, `P finish --status done --summary "QA passed for <feature>"`. Final message: verdict, test counts, the Should-fix items worth doing, the suggested commit message for the whole feature, the file list from `changes.json`, and the commit reminder. End with: "To change this further: `/iterate <RUN_ID> <what to change>`" (a later iteration on a QA'd feature stays in the normal lane unless it starts with `play-first:`).
