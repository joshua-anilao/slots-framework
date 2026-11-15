---
description: Before you commit — checks the shared copy, runs the full check (and the sim if math changed), then lists the uncommitted runs with their commit messages and files.
argument-hint:
---
Pre-commit check. $ARGUMENTS

You are the conductor. Do this in order, and tell Josh in one line when each step starts and ends. Never leave it idle: if something blocks, say exactly what Josh must do.

1. **Shared copy fresh?** `npm run check:cocos`. If it fails, `client-cocos/assets/shared/` is stale: run `npm run sync:cocos` and tell Josh those files are part of the commit. Cocos Creator can stay open for every step here.
2. **Math changed?** Look at the uncommitted runs' `changes.json` (step 5) and `git status --short` for `packages/math-core`, `games/*/game.json` or `strip-weights.json`. If any changed, step 3 adds `--sim` (a few minutes more).
3. **Full check.** Run `bash .pipeline/tools/run-full-check.sh` (plus `--sim` from step 2) with `run_in_background`. It runs `npm run check` (typecheck, Cocos typecheck, every Vitest test, sync check) and writes `.pipeline/precommit/summary.txt`. Do not poll: you are notified when it finishes. If the summary says `typecheck:cocos SKIPPED`, say so: it is not a pass (see `slots-verify` §3).
4. **Report.** On a pass: say total tests passed, elapsed time, and the sim checks if it ran. On a failure: list each failing test with its message, say which run likely caused it (look at the failing test file against `.pipeline/runs/*/changes.json`), and offer `/quick` or `/iterate` to fix it. Do not commit.
5. **What to commit.** `git status --short`, then for every run in `.pipeline/runs/` whose status is `done` and whose files are still uncommitted, list: run id and title, the commit message from its newest `04-review*.md` ("Suggested commit message"), and the file count from `changes.json`. Runs shown as `[QA pending]` in `P list` (play-first lane) have not been tested or reviewed by their own pass: mark them "not QA'd" and suggest `/feature-qa <RUN_ID>` before committing (the full check above still covers existing tests). Say if files from several runs overlap (shared files cannot be split per run), and suggest one combined commit message when they do. Also warn about untracked or unrelated changes (for example `client-cocos/settings/`, `profiles/` or `.meta` files Creator rewrote, sim reports under `games/*/reports/` from a run that did not change math, `.env.local` which must never be committed).
6. **Close.** Remind Josh to commit himself (agents never commit or push), end with the one-line X/10 prompt rating and one fix, and note that the next `/precommit` is needed again only after more runs.
