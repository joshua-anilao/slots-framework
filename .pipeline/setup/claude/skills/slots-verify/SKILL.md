---
name: slots-verify
description: How to typecheck, test, simulate, sync and build the slots framework (math-core, game-logic, HTML prototype, Cocos client) on Josh's Windows PC without disturbing his open Cocos Creator, and how to report results. Use before any test run, sim, sync:cocos, Cocos build or play check in this repo.
---

# Slots verify

Josh works with **Cocos Creator open** on `client-cocos`, like he does with Unity. Almost every check here is plain Node and does not touch Creator. Only a Cocos CLI build of the live project needs Creator closed, so we never do that while he works.

Josh is on Windows. Claude Code's shell is Git Bash: use `npm.cmd` / `npx.cmd` in anything you tell Josh to run (PowerShell), and plain `npm` / `npx` is fine inside Git Bash. Keep Windows paths in single quotes in Git Bash (`'D:\SlotsGame\Slots-Framework'`) or use forward slashes.

## 1. Which check, when

| Check | Command | When | Needs Creator closed? |
|---|---|---|---|
| Typecheck | `npm run typecheck` | after any `.ts` edit | no |
| Related tests | `npx vitest run <file> <file>` | coder and fix loops | no |
| Cocos typecheck | `npm run typecheck:cocos` | after edits in `client-cocos/assets/` | no |
| Shared copy fresh | `npm run check:cocos` | after any `packages/*` edit | no |
| Sync | `npm run sync:cocos` | after any `packages/*` edit or `game.json` change | no (Creator recompiles the copy) |
| Full check | `npm run check` (typecheck + Cocos typecheck + all tests + sync check) | tester on `FULL`, `/precommit` | no |
| Quick sim | `npm run sim -- games/game-001` (1M rounds) | while tuning | no |
| Final sim | `npm run sim -- games/game-001 --spins 10000000` (add `--variant B` etc.) | any math change, before hand-off | no |
| Prototype | `npm run proto` | HTML play check | no |
| Cocos build (live) | `npm run build:cocos` | **only when Josh says Creator is closed** | **yes** |
| Cocos build (copy) | section 4 | when a spec needs a build while Creator is open | no |

## 2. Is Creator open?

Check before anything that would build or write Creator files:
```bash
tasklist //FI "IMAGENAME eq CocosCreator.exe" | grep -i cocoscreator && echo OPEN || echo CLOSED
```
- **OPEN:** `.ts` edits, tests, typecheck, sync and sim are all fine. Never run `npm run build:cocos`, never write `.meta`, `.scene`, `.prefab`, `settings/` or `profiles/` files. Use the copy build (section 4) if a build is needed.
- If a step truly needs the live project closed, open a **Busy engine** gate: ask Josh once to close Creator, wait for his answer, then re-run that one step. Do not loop.
- Creator recompiles `.ts` files under `assets/` on its own when they change. After `sync:cocos`, tell Josh the editor may take a few seconds to reimport `assets/shared/`.

## 3. Tests and sim: rules
- Coder: typecheck + only the related test files. Tester: the scope in `01-spec.md` (`RELATED` = listed files; `FULL` = `npm run check`). Vitest is fast; the whole suite in one call is safe here (unlike Unity).
- Report exact counts from Vitest's last lines (`Test Files  N passed`, `Tests  N passed`). Note the total so the next run can check it rose by the number of new tests.
- `typecheck:cocos` prints `skipped` when `client-cocos/build/cc-declarations/cc.d.ts` is missing. That is a skip, not a pass: say so, and tell Josh to copy it from `D:\Cocos\editors\Creator\3.8.8\resources\resources\3d\engine\bin\.declarations`.
- `check:cocos` failing = `assets/shared/` is stale or hand-edited. Fix by `npm run sync:cocos`, never by editing the copy.
- The sim exits with code 1 when any target in `game.json` is off. Read `games/<id>/reports/<variant>/summary.json` → `checks[]` and paste each `name / value / target / pass`. RTP noise at 10M is about ±0.4% (90% range in `rtpCi90`); do not chase ±0.1%.
- A 10M sim takes minutes: start it with `run_in_background` and keep working. Record the elapsed time next to the result.
- The sim writes `games/<id>/reports/<variant>/`. Those files are expected changes in a math run; list them under items to commit.
- Take `git status --porcelain` before and after a run. Any changed file outside the spec's scope (especially under `client-cocos/` other than `assets/shared/` and `generated/`) goes under "Files outside scope touched".

## 4. Cocos build from a copy (Creator stays open)

Not tried yet in this repo: on the first real use, confirm each step and update this section.

```bash
SRC='D:/SlotsGame/Slots-Framework/client-cocos'
DST='D:/SlotsGame/_cocos-build-copy'   # outside the repo, never committed
npm run check:cocos || { echo 'run npm run sync:cocos first'; exit 1; }
# Mirror the project, skipping editor caches and old output. /MIR deletes stale files in DST only.
robocopy "$SRC" "$DST" //MIR //XD temp local build //NFL //NDL //NJH //NJS; [ $? -lt 8 ] || exit 1
'D:/Cocos/editors/Creator/3.8.8/CocosCreator.exe' --project "$DST" --build 'platform=web-mobile;debug=false'
# Exit 0 or 36 = success (36 on 3.8.8 with this flag). Output: $DST/build/web-mobile
```
- `library/` is copied so the build does not reimport everything; if the build fails on a stale import, delete `$DST/library` and build again (slower).
- Never point `--project` at the live `client-cocos` while Creator is open.
- To play the build: serve `$DST/build/web-mobile` (`npx http-server <dir> -p 7460`) and open `http://localhost:7460/?debug&seed=7`. `globalThis.__ff` exposes `game`, `snapshot()` and `lastRound` for checks.

## 5. Play check (Josh, editor open)
- The quickest look is Creator's own preview: Josh presses **Preview** (Play) and it opens `http://localhost:7456`. Add `?debug` for the debug panel.
- Every hand-off with anything visual or audible lists a short **Play check**: what to do (seed, debug option, speed: normal / turbo / super), what he should see and hear, and the matching row in `docs/COCOS_PARITY.md`.
- For the HTML prototype: `npm.cmd run proto`, then the URL Vite prints.

## 6. Known traps
- **Loose mode:** Cocos compiles in loose mode. `[...aSet]`, spreading Map/Set iterators and `for (x of map.values())` silently do nothing. Use `Array.from(...)`. `tools/engineCompat.test.ts` guards this: run it whenever code reaches `client-cocos`.
- The scene stays empty on purpose: `client-cocos/assets/game/gameBootstrap.ts` builds its own Canvas and Camera after the scene launches. Do not add nodes to the scene.
- `client-cocos/assets/game/generated/gameConfig.ts` is made from `games/game-001/game.json` by `sync:cocos`. Change the JSON, then sync.
- Never read, print or commit `.env.local` or `FAL_KEY`.

## 7. Report
Put results into the run file (`02-implementation.md` or `03-tests.md`), then the final hand-off in `docs/agents/handoff-format.md` order: commit message, items to commit, how to check (with the exact commands above and expected counts), prompt rating. Say plainly what you could not check (for example "typecheck:cocos skipped, no declarations" or "no Cocos build: Creator open, copy build not needed").
