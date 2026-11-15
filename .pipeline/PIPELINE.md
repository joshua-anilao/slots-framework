# Pipeline rules (for the main session running a command)

Slots Framework copy, adapted from RapidPro (Unity) on 2026-11-15. Agents, commands and skills live in `.pipeline/setup/claude/` and are copied into `.claude/` by `.pipeline/setup/install-claude-files.mjs` (run by `start-pipeline.cmd`). Edit the copies here, not in `.claude/`. After adding or changing an **agent**, restart Claude Code: agents load only at startup (commands and skills load at once). A conductor that gets `Agent type '<name>' not found` must stop and ask for a restart, never stand in a general-purpose agent.

You are the conductor. Subagents cannot launch other subagents, so you launch each agent in order, pass it the run folder, and log every step so the dashboard shows it. `P` below means `node .pipeline/tools/pipeline.mjs`.

**Never leave a run idle.** The pipeline tool only records stages; nothing starts the next one for you. The moment a subagent reports back (even if the report arrives as a message from another session), log its stage `done` and launch the next stage in the same turn. Stop only for a gate, a `CHANGES_NEEDED`/failed verdict, or the end of the run. Never answer a hand-back with "no response needed". Tell the person in one line each time a stage starts or ends (for example "Coder done, tester running"), and run `P status` before every reply to the person: it prints `STALLED` when a stage finished and nothing started after it.

## Every run
1. **Start**: `P start --type <type> --title "<3–6 word title>" --request "<the request>"`. It prints `RUN_ID` and `RUN_DIR`. Use that exact path everywhere below, and pass `--run <RUN_ID>` to every later `P` command so two runs can never mix. Put the run folder path at the top of every agent prompt (token counting uses it to match agents to runs).
2. **Before each agent**: `P stage --name <agent> --status running`.
3. **Launch the agent** with a prompt that contains: the run folder path, which files to read, which file to produce (or "return your output; do not write files" for read-only agents), and for fix loops the loop number.
4. **After each agent**: `P stage --name <agent> --status done` (or `failed`), then `P handoff --from <agent> --to <next> --file <file> --summary "<one line>"`.
5. **Read-only agents** (reviewer, researcher, ux-reviewer, triager) return text. Save it with the Write tool into the run folder under the file name the command gives, word for word.
6. **Approval gates**: `P gate --question "<what you need>"`, then ask the person with AskUserQuestion (or plain text if unavailable). When they answer: `P gate --resolve approved|rejected --note "<their answer>"`. If nobody answers, stop at the gate and leave the run waiting; never guess past a gate.
7. **Busy engine**: Cocos Creator stays open while Josh works and that is normal: `.ts` edits, tests, typecheck, `sync:cocos` and the sim never need it closed. Only a CLI build of the live `client-cocos` does. If a stage truly needs that (normally use the copy build in `slots-verify` §4 instead), open a gate asking Josh to close Creator, and re-run that same agent once he answers.
8. **Finish**: `P finish --status done|failed|cancelled --summary "<one line>"`.

## Lanes: full, play-first, QA
- **Full** (`/feature <request>`): planner → coder → tester → reviewer. Use it for big or risky features and anything that touches the framework.
- **Play-first** (`/feature play-first: <request>`): planner → coder, then the run finishes with `tester` and `reviewer` skipped and `qa: pending` in `run.json` (`P start --lane play-first`). The person plays it. `/iterate` on it inherits the lane, so every tweak costs a coder pass only. Nothing in this lane is tested or reviewed: the final message says so.
- **QA** (`/feature-qa <run>`): one tester → reviewer pass over the whole feature (every run with the same `root`), using `P diff --since <run>` for a single combined diff, then `P qa --status done` on each run in the chain. `P list` shows `[QA pending]` for play-first runs not yet QA'd, and `/precommit` warns about them.
- Pick the lane by risk: feel and visuals you must see first → play-first; shared code, framework, save or rules logic → full.

## Variants (when the request asks for one)
A **variant** is a selectable alternative kept side by side with the others (e.g. a second result screen, another control scheme). Treat a request as a variant run only if it says "variant", "as an alternative", "keep the old one", or names a slot and variant.
- Before the planner: `P variant list` and pass the output to the planner.
- After `PASS`: register it. New variant: `P variant add --slot <slot-key> --label "<Slot label>" --name "<variant name>" --select "<how it is picked, if the slot is new>" --run <RUN_ID>`. A new *option* that combines on top of a variant (like a body pattern on the flat look): `P variant update --slot <key> --id <vN> --option "<option name>" --run <RUN_ID>`. Iterating on an existing variant: `P variant update --slot <key> --id <vN> --run <RUN_ID>`.
- The final message names the slot, the variant id and how to select it.
- Not a variant run, but the change touches a slot that has variants: it changes the variant the request names, or the slot's default if none is named; the planner says which under Open questions (Non-blocking).

## Experiment runs (`/feature experiment: …`)
For "let me try this and see" requests. Same stages, lighter:
- The planner writes a half-page spec and treats everything as Non-blocking.
- The feature must sit behind a toggle that is off by default: a `game.json` key (read through the config service) and/or a debug panel row, never a hard-coded flag.
- The coder typechecks and runs only the tests for the code it touched; the tester adds game-logic / math-core tests only and runs the related test files, not the full check. Mark the run `Trying` in `docs/FEATURES.md`.
- An experiment that changes math still needs a 10M sim before Josh plays it, so the debug panel shows honest RTP.
- The reviewer still checks for must-fix bugs and lock-ups, but skips style should-fixes.
- If Josh keeps it, run `/iterate <RUN_ID> harden` to add the full tests and `npm run check`. If he drops it, run `/iterate <RUN_ID> remove` (removes code, toggle and registry row).
- The final message says "experiment: not fully tested".

## Feature registry
After PASS, update `docs/FEATURES.md`: add or edit the row (feature number, status, how to switch it: `game.json` key or debug panel, run id). Mutually exclusive alternatives still go through Variants. Each time a run touches a `Trying` feature, ask in the final message whether to mark it `Keep` or `Drop`.

## Full suite
The full check is `npm run check` (typecheck, Cocos typecheck, every Vitest test, `shared/` copy fresh). It is fast and safe to run whole, and never needs Creator closed. `/precommit` runs it through `.pipeline/tools/run-full-check.sh` (add `--sim` when any math changed). Details: `.claude/skills/slots-verify/SKILL.md`.

**Test scope is decided by the planner**, in a `Test scope: FULL | RELATED` line at the end of `01-spec.md`:
- `FULL` when Josh asks for a full test (or `/iterate <RUN_ID> harden`), or the change touches `packages/math-core`, a shared interface, service, event, state machine or config used by many features. The tester runs `npm run check` and puts the counts in `03-tests.md`.
- `RELATED` for everything else: typecheck plus the listed test files (`npx vitest run <files>`), plus `check:cocos` if a package changed. Experiments are always `RELATED`.
- The conductor may upgrade a run to `FULL` when the coder's file list turns out wider than the spec said. `/precommit` is the safety net that makes `RELATED` runs safe.

## Math gate
Any run that changes `packages/math-core`, `game.json` math, `strip-weights.json` or the paytable must end with a 10M-round sim (`npm run sim -- games/game-001 --spins 10000000`, per variant the spec names) whose checks all pass (RTP 96.5% ± 0.5%, hit rate, free spins frequency, buy bonus RTP). The tester records it in `03-tests.md`; the reviewer blocks without it. A failed check is a `CHANGES_NEEDED`, never a silent retune.

## Commit cadence and feel check
- Remind Josh in every final message to commit this run before starting the next one if another run's files are still uncommitted (runs share `game-logic` controllers, `pace.ts`, `game.json` and `gameBootstrap.ts`, so overlapping diffs get hard to review).
- If a run changed `packages/*`, the coder ran `npm run sync:cocos`: the regenerated `client-cocos/assets/shared/` files belong in the same commit.
- Nothing in a run is seen or heard by the agents. When a run adds visuals, sounds or timing, the final message lists a short **Play check**: open Creator's Preview (`http://localhost:7456/?debug`) or the prototype, what to do (seed, speed, debug option) and what to look and listen for, plus the matching `docs/COCOS_PARITY.md` row.

## Process review
Every agent ends its reply with a `## Process feedback` section. After each agent, append that section to `process-feedback.md` in the run folder under a `### <agent>` heading (word for word; write "(none given)" if it is missing). Before finishing, add `### conductor` with your own three lines: what slowed the run (gates, retries, fix loops, waiting on the Editor), what was missing, and one suggestion. The dashboard shows this file as the run's **Improvements** tab and collects all runs under **Process improvements**. When the person asks to improve the pipeline, read these files first and look for repeated points.

The hooks in `.claude/settings.json` log every tool call and agent launch automatically; you only log stages, handoffs, gates and the finish.

## Stopped from the dashboard
The person can press **Stop** on a run in the dashboard. The run is marked `cancelled`, any command running at that moment is ended, and the hook denies further tool calls with a reason that starts with `STOPPED:`. When you see that, do not retry, resume or `finish` the run; end your turn with one line saying it was stopped and what was left half-done. Resume only if the person asks (`P resume --run <RUN_ID>`).

## Never
- Commit, push, switch or delete branches. The person commits.
- Skip a stage silently. If you skip one, log `P stage --name <agent> --status skipped --note "<why>"`.
- Run more fix loops than the command allows.
- Let an agent write outside the folders its definition allows.
- Edit `client-cocos/assets/shared/`, `generated/`, `.meta`, scene or prefab files by hand, or run `npm run build:cocos` while Creator is open.
- Start paid image generation; art has its own cost gate (`image-prompting` skill).

## Final message to Josh
Follow `docs/agents/handoff-format.md` ("Final report"):
1. Outcome in one line (verdict, tests count, sim RTP if math changed).
2. Commit message in Josh's format (`ADDED|UPDATED|FIXED: ...` plus 2–6 bullets), taken from the review.
3. Items to commit: exact paths, including Cocos `.meta` files next to new assets and regenerated `assets/shared/`; flag unrelated changed files.
4. How to check: commands with expected counts, and the Play check.
5. Anything waiting on Josh (open gates, `Trying` features to mark Keep or Drop).
6. Code runs that add or change visuals, sounds or timing: a "Values you can tune yourself" line (3–5 fields with file and key) from `docs/TUNING.md`. If the run added a tunable, the coder adds its row; the reviewer checks it.
7. `Prompt rating: N/10` plus one fix for the request, then the reminder to commit before the next run.

Dashboard: `.pipeline\setup\start-pipeline.cmd` (or `node .pipeline/dashboard/server.mjs --port 4701 --open`), then http://localhost:4701. Port 4701 so it can run next to RapidPro's dashboard on 4700.
