# Slots Framework: project brief for agents

**Every agent reads this file first**, then the docs in its row of "Docs per role" (section 8). Updated 2026-11-15.

## 1. What this project is

A framework for slot games aimed at the PH market (JILI / PG / Fa Chai style). One pure TypeScript math engine and game logic are shared by two clients:

- **Track 1, HTML prototype** (`prototype-web/`, Vite): fast experiments on themes, mechanics and payouts.
- **Track 2, Cocos production client** (`client-cocos/`, Cocos Creator 3.8.8): the real game on reusable prefabs.

Josh is the product owner and a new slots PM: explain math in plain words. Claude does most of the coding; Josh plays, reviews and **commits himself**.

Current game: `games/game-001`, "Fishball Fiesta" (Pinoy street food theme). Super Ace-style mechanics and layout, original name and art: 5x4, 1,024 ways, cascades, multiplier ladder variant A, golden cards to WILD, scatter free spins, buy bonus 50x, max win 2,000x.

## 2. Where things live

| Path | What | Part |
|---|---|---|
| `packages/math-core/` | Engine: RNG, reels, ways, cascade, multipliers A–D, golden wild, free spins, buy bonus, override layer. Pure TS, no DOM/Node/Cocos imports | framework |
| `packages/game-logic/` | Models, controllers, state machines, services (`ISpinService`, `IWalletService`, `IHistoryService`, `IWinFeedService`, `IConfigService`), pacing (`presentation/pace.ts`), strings | framework |
| `packages/simulator/` | Node CLI: RTP report, PAR sheet, checks | framework |
| `prototype-web/src/framework/` | HTML views | framework |
| `client-cocos/assets/framework/` | Cocos views: board, symbols, HUD, overlays, screens, audio, assets, debug panel | framework |
| `client-cocos/assets/shared/` | **Generated copy** of math-core and game-logic. Never edit by hand; run `npm.cmd run sync:cocos` | generated |
| `client-cocos/assets/game/` | Fishball Fiesta's Cocos bootstrap, manifests, board style; `generated/gameConfig.ts` is generated | game |
| `games/<id>/` | `game.json` (math), `strip-weights.json`, `brief.md` (decisions), `guides/` overrides, `theme/` (art, prompts, art log), `reports/A–D` | game |
| `tools/` | sync, build, typecheck for Cocos, strip builder, quick sim, variant sweep, art export, `imagegen/` (fal.ai) | tooling |
| `docs/` | Math guide, screens and features, Cocos parity, art workflow, this folder | docs |
| `guides/` | programming, art, design (defaults; per-game overrides in `games/<id>/guides/`) | docs |

## 3. How the parts connect

```
games/<id>/game.json ─► math-core (decides every outcome) ─► RoundResult
                                                          │
                        game-logic (models + controllers + state machines)
                          ├─► prototype-web views (HTML)
                          └─ sync:cocos ─► client-cocos/assets/shared ─► Cocos views
simulator ─► math-core × millions of rounds ─► games/<id>/reports/<variant>/
```
Views only **play back** a `RoundResult`. Services swap local → server in one place (the bootstrap).

## 4. Rules that never break

1. **The client never decides outcomes.** Only math-core does. Views play back `RoundResult`.
2. **math-core and game-logic import no engine** (no DOM, Node or Cocos).
3. **The framework never imports from a game** and never names a game, its symbols or its art.
4. **Config, not code.** No magic numbers; tunables go in `game.json`, `pace.ts`, win tiers or the game's style files, and get a row in `docs/TUNING.md`.
5. **Debug overrides are session only.** Never write them into `game.json` without Josh's OK.
6. **Any math change runs the sim** (`npm.cmd run sim -- games/game-001 --spins 10000000`) and the RTP must stay 96.5% ± 0.5% before hand-off.
7. **Never edit `client-cocos/assets/shared/` or `generated/` by hand.** Edit `packages/*`, then `npm.cmd run sync:cocos`.
8. **Cocos `.meta` files:** never create or hand-edit them; Creator makes them. Commit each `.meta` with its asset.
9. **Never touch Creator's project while Josh has it open**, except source `.ts` files (Creator recompiles those itself). No CLI build of the live `client-cocos` while Creator is open: build from a copy (see `slots-verify`).
10. **Cocos compiles in loose mode:** no `[...set]`, no spread of Map/Set iterators, no `for (x of map.values())`. Use `Array.from(...)`. Guarded by `tools/engineCompat.test.ts`.
11. **Anything with steps is a state machine** with a transition table, not booleans.
12. **Feature numbers are permanent** (`docs/SCREENS_AND_FEATURES.md` §5). New features get the next free number.
13. **Claude never commits, pushes, switches or deletes branches.**
14. **Never read, print or commit `FAL_KEY` or `.env.local`.**
15. **Never regenerate or overwrite hand-tuned assets** (list below).
16. **Original art and names only.** Mechanics may follow genre standards; names, logos and art may not copy a real game.

### Never touch
- `games/game-001/theme/source/`, `theme/symbols/`, `theme/atlas/` once Josh has approved them (check `theme/art-log/LOG.md`).
- `client-cocos/assets/scenes/` (Josh made the scene in the editor).
- `games/<id>/reports/` are written only by the simulator.

## 5. Commands (Josh is on Windows PowerShell: use `npm.cmd`)

| Command | What | Needs Creator closed? |
|---|---|---|
| `npm.cmd run typecheck` | TS check, packages + prototype | no |
| `npm.cmd test` | Vitest, all unit tests + quick RTP band | no |
| `npm.cmd run check` | typecheck + Cocos typecheck + tests + shared/ is fresh | no |
| `npm.cmd run sync:cocos` | Copy packages into `client-cocos/assets/shared` | no (Creator picks it up) |
| `npm.cmd run sim -- games/game-001 --spins 10000000` | Full math report | no |
| `npm.cmd run sim:compare` | 1M-round sim of variants A–D in one table (~80 s), writes no reports | no |
| `npm.cmd run proto` | HTML prototype dev server | no |
| `npm.cmd run build:cocos` | Cocos web-mobile build of the live project | **yes** (or build from a copy) |

Details, the copy build and how to tell Creator is busy: `.claude/skills/slots-verify/SKILL.md` (to be written, setup step 3).

## 6. UI and art rules (short)
- Every screen and popup is animated; nothing just appears.
- Bet − / + wraps around (max → min, min → max).
- During free spins the title shows **FREE SPINS LEFT n / N**.
- Portrait 720×1280; desktop shows portrait centred. Boot < 5 s to Continue.
- Spin button is locked while a round animates; board taps during animation do nothing.
- No scaling or squash on cards (shake instead). Win amount shows big in the board centre.
- Tap AUTO = infinite auto spin, hold = options, pause icon while running.
- Loading bar turns into Continue at 100%. Tutorial arrows loop without rewinding.
- The word is SCATTER, not "Free Spins", on the symbol. Winner notices sit over the multiplier bar.
- Banner text auto-fits the screen. Touch sparkle everywhere.
- Art: follow the `image-prompting` skill; show Josh model and cost and wait for his go-ahead before any paid generation; log with `art-log`.
- A Cocos drop is only done when its rows in `docs/COCOS_PARITY.md` are DONE and Josh has seen them in the browser.

## 7. Final report format

Every hand-off ends with, in this order (details in `handoff-format.md`):
1. Commit message in Josh's format.
2. Items to commit (exact paths; what to leave out; unrelated changed files flagged).
3. How to check (commands, expected counts, what to click or look at; a short Play check for anything visual or audible).
4. `Prompt rating: N/10` plus one fix for the instructions you were given.

## 8. Docs per role

| Role | Reads besides this file |
|---|---|
| planner | `FRAMEWORK_SPEC.md`, `PLAN.md`, `docs/SCREENS_AND_FEATURES.md`, `docs/COCOS_PARITY.md`, `docs/FEATURES.md`, `glossary.md`; `docs/MATH_ENGINE_GUIDE.md` for math work |
| coder | `guides/programming/PROGRAMMING_GUIDE.md`, the run's `01-spec.md`, the README of each package it changes, `docs/TUNING.md`, `slots-verify` |
| tester | the run's `01-spec.md` and `02-implementation.md`, `guides/programming/` §10, `slots-verify`; `docs/MATH_ENGINE_GUIDE.md` for math work |
| reviewer | the whole run folder, `guides/programming/`, `bug-check` skill, `handoff-format.md` |
| triager | `bug-check` skill, `glossary.md` |
| art work | `guides/art/ART_GUIDE.md`, `games/<id>/guides/art.md`, `docs/ART_WORKFLOW.md`, `image-prompting` skill |
| design / UX | `guides/design/DESIGN_GUIDE.md`, `docs/SCREENS_AND_FEATURES.md` |

## 9. Agents and models

| Agent | Model | Effort | Job |
|---|---|---|---|
| planner | Opus | high | Request → `01-spec.md` |
| coder | Sonnet | medium | Spec → code + `02-implementation.md` |
| tester | Sonnet | medium | Tests per acceptance criterion → `03-tests.md` |
| reviewer | Opus | high | Read only → `04-review.md` with verdict and commit message |
| triager | Haiku | low | Small bug → `01-triage.md`: QUICK or ESCALATE |
| art-log | (existing, `agents/art-log.md`) | | Art log entries |

The pipeline runs in **Claude Code on Josh's PC** with Creator open. Planning and review talk can also happen in the claude.ai project threads.
