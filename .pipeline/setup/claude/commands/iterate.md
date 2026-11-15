---
description: Iterate on an earlier /feature run — builds the next version (v2, v3 …) from what that run already made, changing only what you ask
argument-hint: <run id, or a few words of its title> <what to change>
---
Iterate on an earlier feature:

$ARGUMENTS

Follow `.pipeline/PIPELINE.md`. `P` = `node .pipeline/tools/pipeline.mjs`.

1. **Find the parent run.** The first argument is a run id, or words from a run title. `P list` shows runs; pick the newest `feature` run whose id or title matches (prefer the latest iteration of that feature). If nothing or several match, ask once with the candidates. The rest of the arguments is the change request.
2. `P start --type feature --parent <parent id> --request "<change request>"`. The title becomes "<feature> v<n>" automatically. Pass `--run <RUN_ID>` to every later `P` command. If the change request starts with `play-first:`, add `--lane play-first` (and strip the prefix); otherwise the run inherits the parent's lane, if any.
3. **planner** → "Iteration run. Parent run folder: `.pipeline/runs/<parent id>`. Read its `01-spec.md`, `02-implementation.md`, the last `04-review*.md` and `changes.json` first. Write `01-spec.md` for this run as a **delta**: what changes and why, new or changed acceptance criteria (number them continuing from the parent, e.g. AC9, AC10), which existing criteria must keep passing, and the files likely to change. Don't repeat unchanged parts of the parent spec; reference them." Blocking questions → gate as in `/feature`.
4. **coder** → "Iteration run: build on what the parent made (see its `02-implementation.md` and `changes.json`). Change only what the delta spec asks."
5. If the parent run has `"lane": "play-first"` in its `run.json`, the new run inherits the lane (`P start` does this): follow the **play-first lane** in `feature.md` from its step 2 (half-page delta spec, coder only, tester and reviewer skipped, finish with "play-first, not tested or reviewed"). The person runs `/feature-qa` when they are happy. Otherwise continue exactly as `/feature` steps 4–7 (tester, diff, reviewer, fix loops, finish). The reviewer checks the delta spec plus that the parent's criteria still pass (tests).
5b. If the parent run built a variant (its `run.json` has `variant`), this run improves that same variant: after PASS run `P variant update --slot <slot> --id <id> --run <RUN_ID>`. If the request asks for a *new* variant instead, follow "Variants" in `PIPELINE.md`.
5c. Two reserved change requests: `harden` (parent was an experiment: add the full tests, run `npm run check` and, if it touched math, the 10M sim; mark it `Keep` in `docs/FEATURES.md`) and `remove` (parent was dropped: remove its code, config toggle, debug panel row, tests and `docs/FEATURES.md` row; mark it `Drop` first, then delete the row; run `sync:cocos` if a package changed).
6. The final message lists what changed since the parent version, the commit message and file list, and the next `/iterate` command.
