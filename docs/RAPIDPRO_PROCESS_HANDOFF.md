# RapidPro process handoff for the Slots Framework

**From:** the RapidPro project (Unity, `D:\YT-Playables`) · **To:** Claude working in `D:\SlotsGame\Slots-Framework` · **Date:** 2026-11-15

## 0. Read this first

Josh built a rapid-prototyping process for hyper/hybrid-casual games in Unity called **RapidPro**. He wants the same process in the slots project. This file tells you what that process is, so you can rebuild it here.

Two things to know before you start:

1. **The engines are different.** RapidPro is Unity 6 + C#. Slots is TypeScript (`math-core`, `game-logic`, simulator, HTML prototype) + Cocos Creator 3.8. **Do not port C# code.** Port the *ideas*: the rules, the folder discipline, the agent pipeline, the hand-off format and the reports. Section 6 maps each Unity idea to its slots equivalent.
2. **A lot is already here.** Your `CLAUDE.md`, `FRAMEWORK_SPEC.md` and `guides/programming/PROGRAMMING_GUIDE.md` already have SOLID + MVC, config-not-code, framework/game split, "Claude never commits", the three-part hand-off and the Work Status page. What slots does **not** have yet is mostly the **agent pipeline** (agents, slash commands, run folders, dashboard, hooks) and the **project docs the agents read**. Section 8 is the gap list.

**What to do with this file:**
1. Read it and compare it with `FRAMEWORK_SPEC.md`, `PLAN.md` and `CLAUDE.md`.
2. Write Josh a short gap list: what slots already has, what to add, what to skip, and anything that contradicts a slots decision (slots decisions win unless Josh says otherwise).
3. Build the missing pieces in the order in section 9, one small step at a time, each ending with the hand-off in section 7.7.

Status words used below: **Built** = exists in RapidPro today. **Not built** = planned, not in the code. **Slots: have / add / adapt / skip** = what to do here.

---

## 1. What RapidPro is

A reusable framework package plus an AI workflow for building small mobile games fast, with Claude doing most of the coding and Josh reviewing, playing and committing.

**Four goals every change must serve**

| Goal | Meaning | Slots |
|---|---|---|
| Reusable | One framework, many games. Game-specific code never leaks into the framework | have (spec §4, guide §4) |
| Configurable | Every tunable lives in a config asset with tooltips and ranges, editable live. No numbers hidden in code | have (`game.json`, "no magic numbers") |
| Extendable | New features are new modules that plug into Core and the event bus, not edits to existing modules | have (recipes, guide "O") |
| Iteration friendly | Sandbox scenes, debug panel, "play this level now", play from any scene | partly (debug overrides); add the rest per section 6 |

**Code principles (Josh's rules, same in both projects)**
- SOLID, but **readability for a mid-level developer wins every tie**. "Nothing too outrageous."
- Plain names. At most one framework base class between a class and the engine's base class. No reflection auto-wiring.
- Small interfaces (`IAudioService` for playing, `IAudioSettings` for the settings screen only).
- Depend on interfaces; register them **by hand in one installer** (a plain service locator). Designed so a DI container could replace it later, but no container now.
- One public type per file, doc comments on public APIs, unit tests on core logic.
- Reactive state: expose read-only observables, keep writable state private, dispose every subscription.
- Log through one framework logger, not the engine's raw log.
- No paid tools beyond Claude Code (slots has an explicit exception for fal.ai art; keep that as Josh decided).

---

## 2. Framework layout (RapidPro)

- One package: `Packages/com.rapidpro.framework` (embedded UPM package; UPM names must be lowercase).
- **One assembly per module**, prefixed `RapidPro.` (`RapidPro.Core`, `RapidPro.Audio`, …). Tests per module (`RapidPro.Audio.Tests`), test doubles in `RapidPro.<Module>.TestDoubles`.
- `Runtime/<Module>/`, `Editor/<Module>/`, `Tests/Editor/<Module>/`, `Tests/Runtime/<Module>/`.
- Game code in `Assets/Game` (`Game.asmdef`). **The game references the framework, never the reverse.** Nothing in the package may name a game, its art or its rules.
- Optional add-ons compile only when their dependency is installed (planned: `RapidPro.Tween` for DOTween, `RapidPro.MobSakai`, `RapidPro.URP` behind `RAPIDPRO_URP`).
- One `README.md` in the package documents **every module's API with short code samples**. Agents read it before searching code. This README is a big time saver; slots should have the same (one README per package, kept current by every run that changes an API).

**Slots: have.** `packages/*` + `client-cocos/assets/framework/` vs `games/<id>/` is the same split. Keep the "one module per folder, own tests, own README section" habit. A TS workspace package or folder per module is the asmdef equivalent; enforce direction with a lint rule or a test that greps imports (the asmdefs enforce it for free in Unity, TS does not).

---

## 3. Modules: what exists and what a game must provide

| Module | Status | What it gives | What a game must provide | Slots |
|---|---|---|---|---|
| Core | Built | `Services` locator (register/get/tryGet by interface), `Log`, `GameInstaller` base | One installer subclass in the Bootstrap scene that registers every service by hand | adapt: you already have "wired in one place"; make sure it is one readable file |
| Events | Built | `IEventBus` (R3). Events are small past-tense structs (`LevelCompleted`) | Its own event types | adapt: a typed bus in `game-logic`; slots events like `SpinStarted`, `RoundSettled`, `BigWinShown` |
| MVC | Built | `Model` (plain, reactive props), `View` (engine component, no rules, exposes clicks as observables), `Controller<TModel,TView>` | Its models, views, controllers | have: and better, since M+C are shared pure TS |
| Pooling | Built | `IPoolService` Spawn/Despawn, `IPoolable` reset hooks, `PoolConfig` asset with prewarm | Prefabs and prewarm counts | add in Cocos: symbols, win labels, particles |
| StateMachine | Built | `StateMachine<TStateId>`, async enter, ignores changes while one is running (stops double taps), observable current state | Its states | have (guide §3 is stricter: transition tables, illegal moves throw). Keep the RapidPro rule "a change requested mid-change is ignored with a warning, not queued" |
| Audio | Built | BGM crossfade, SFX source pool (8), `AudioCue` asset (clips, volume, pitch range, min gap), volume saved | Cues | adapt for Cocos; the min-gap rule matters for cascades and count-ups |
| Save | Built | Key-value JSON file, temp-file-then-replace writes, `Flush` on background/quit, keys named by feature (`audio.musicVolume`) | Its keys | adapt: settings and "don't show tutorial again" locally; wallet and history stay behind server-ready services |
| Lifecycle | Built | Pause by **reason** (popup, background, debug); stays paused until every reason resumes. Background flush, back button | Its pause reasons | add: autospin must stop or pause on background and popups |
| Display | Built | Canvas fit, safe area panel, camera fit (fits a circle so rotation never resizes), zoom/pan | Board bounds after a level loads | adapt: portrait 720×1280, desktop centred (spec §3) |
| Scenes | Built | Bootstrap (persistent) → Loading → Game + GameUI, play from any scene | Scene names in a settings asset | adapt: see section 4 |
| Input | Built | Tap, double tap, hold, drag, flick, pinch on touch and mouse, config asset | Subscriptions | mostly skip: slots input is buttons. Keep "hold" for the autospin button |
| Feedback | Built | Touch ripple, screen flash, particle burst, each with a config asset and editor builder | Configs | adapt: win tiers, coin bursts, screen flash on Big/Super/Ultra |
| UI | Partly built | `ProgressBar`, `PlusMinusSlider`, a code-drawn UI atlas. **No ScreenManager or popups yet** | Screen prefabs | slots plans its own screen manager (PLAN phase 4); build it there |
| GameLoop | Built | `IGameMode` (Cleanup → PrepareAsync(level) → Begin; game calls Win/Lose), `LevelData` base, `LevelCatalog`, `GameRoot` prefab, `LevelStarted/Completed/Failed` events | A `LevelData` subclass + catalog, one `IGameMode`, a prefab variant of `GameRoot` (never edit `GameRoot` itself) | **adapt heavily**: see section 6 |
| DebugTools | Built | In-game panel (F1, backtick, three-finger tap), dev builds only, pauses game, built-in win/lose/skip/jump/reset save/FPS, `DebugPanel.Add/AddSlider/AddToggle/AddChoice` with live getters, categories | Its own rows, removed on destroy | have (spec §7, session-only overrides). Copy the "rows read live getters" and "categories" API shape |
| LevelEditor | Built | Play Mode editor shell: panel, Play this level, Save as new / Overwrite, open with pictures, difficulty and validation line, level list (reorder, rename, duplicate, delete, start here). Each game adds a `LevelEditorTool<TLevel>` marked `[LevelEditorFor(typeof(X))]` | Its tool component + level type | adapt: see section 6 |
| Haptics | Not built | | | slots open question 5 |
| Tween / Mob Sakai / URP add-ons | Not built | | | skip (Unity only) |
| Sandbox scenes | Not built as framework scenes | | | add: a "symbol and win sandbox" page in the prototype |
| Later modules | Not built | Economy, Boosters, Tutorial, Daily rewards, Settings; before release: consent/ATT, rate us, localization; hooks only: Ads, IAP, Analytics, Remote config | | slots has its own list in `SCREENS_AND_FEATURES.md` |

**How to make a game on RapidPro (three steps, the bar a framework should hit):**
1. A `LevelData` subclass and a `LevelCatalog` asset.
2. One `IGameMode` that builds the level, listens to input and calls `IGameLoop.Win()` / `Lose()`.
3. A prefab variant of `GameRoot.prefab` holding the game mode and board.
UI only reads `IGameLoop.State` and small read-only game interfaces (e.g. `IHearts`), never the game mode directly.

Slots equivalent to aim for: "a new slot = `game.json` + `recipe.json` + `theme/` + only the new feature modules", which your PLAN phase 7 already says.

---

## 4. Scene flow and config

**RapidPro scene flow (built):**
```
Bootstrap (stays loaded, holds the installer and all services)
  → Loading (optional: logo + progress bar, unloads after)
  → Game (one scene for every level; levels are data) + GameUI (one canvas, screens as prefabs)
```
- No menu scene: a tap-to-play Home overlay instead.
- **Play from any scene** (Editor): pressing Play anywhere loads Bootstrap first, then the scene you were in, so services always exist. Sandbox and editor scenes work without setup.
- Restart and next level never reload scenes: `Cleanup` returns everything to the pool, `PrepareAsync` builds again.

**Config:** every tunable is a ScriptableObject asset (`Assets > Create > RapidPro > …`), with `[Tooltip]` and `[Range]`, editable in Play Mode. A `Docs/Tuning.md` table lists each tunable Josh can change himself (field, asset, Inspector section), so small value changes need no pipeline run.

**Slots:** Boot → Loading → Idle ⇄ Round in your Game state machine already covers this. Adapt:
- Config = `game.json` + per-game overrides. Add a `docs/TUNING.md` listing every value Josh can change by hand (file, key, range, what it feels like), and have the coder add a row whenever it adds a tunable.
- "Play from any scene" = every Cocos scene and every prototype page boots the services itself in dev, so Josh can open the screen he is testing directly.

---

## 5. Level data and the level editor extension point

**RapidPro (built):**
- `LevelData` base (a ScriptableObject) carries display name, **picture** (screenshot) and **difficulty score + label**. Each game subclasses it.
- `LevelCatalog` lists levels in play order. Winning saves the next index.
- `IGameLoop.PlayLevelAsync(level)` plays any level right away **without touching saved progress**; editors and the debug panel use it.
- Level editor runs **in Play Mode, with the game as the canvas**: you edit settings and see the level played with its real rules. The shell does the repeated work (panel, save, open, list, pictures, difficulty); each game's tool only draws its own settings. Several tools can sit on the shell; opening a level picks the tool for its type.
- Lessons Josh wants kept: generators must be **solvable by construction** and verified by a solver; difficulty is a weighted score with weights in a config asset; show validation before save.

**Slots mapping:** a slot has no levels. The equivalents are:
| RapidPro | Slots |
|---|---|
| `LevelData` subclass | `game.json` (strips, paytable, features) + `recipe.json` |
| `LevelCatalog` | list of games/variants (`games/<id>`, multiplier variants A–D) |
| Level editor tool | a **math/config editor** page in the prototype: edit strips/paytable/ladder, "Spin 1M now" via the simulator, show RTP/volatility/hit rate as the "difficulty line", save as new variant or overwrite (with Josh's OK, per your rule that debug overrides never write to `game.json`) |
| Solver verifies a level | simulator verifies the math (RTP band test) |
| Play this level | play this config now, seeded, session only |
| Level picture | a screenshot of the reel layout or the sim report chart |

---

## 6. Slots-specific things RapidPro does not cover

RapidPro is built for puzzle/arcade games. It has **nothing** for these; slots must own them (most are already in your spec):

- **Reels and strips**, reel layout (5×4), symbol sets, stops.
- **Evaluation**: 1,024 ways (and paylines if a later game needs them), scatter, wilds, golden-symbol-to-wild.
- **Cascades** and the cascading **multiplier ladder** (variants A–D).
- **Free spins** (trigger, retrigger), **buy bonus**, **max win cap**.
- **Certified-style RNG**: seeded, replayable, outcome decided only by math-core; the client plays back `RoundResult` and never decides.
- **Simulation and math reports**: RTP, volatility, hit rate, PAR sheet, millions of spins before any math hand-off.
- **Economy**: wallet, bet levels, balance, demo currency (₱), bet history, winner feed, all behind server-ready interfaces.
- **Win presentation**: win tiers (Big/Super/Ultra), count-ups, skip/turbo pacing.
- **Autospin and turbo** state machines; stop conditions.
- **Re-skinning**: atlases with fixed frame names, Spine-ready symbol view.

**Rules from RapidPro that become more important in slots:**
- Unity Editor numbers lie (the Editor costs ~20 ms per frame). Measure on a real phone build. Your "boot < 5 s on mid-range Android over 4G" target needs the same "measure before optimising" habit: before/after numbers, say which build and device.
- Many identical moving pieces (symbols in a cascade): pool them, batch them in one atlas, skip work for what did not move.

---

## 7. The AI workflow (the part to rebuild)

This is the real "RapidPro process". All of it is plain files in the repo, so it ports to any engine.

### 7.1 Files the agents read (RapidPro paths)

| File | What | Slots |
|---|---|---|
| `CLAUDE.md` | Short: where code lives, framework rules, reactive rules, how to test, pointer to the pipeline | have; add the pipeline block |
| `Docs/Agents/project.md` | **Every agent reads it first.** What the project is, where things live, how the main systems connect, **rules that never break**, compile/test commands, UI rules, art rules, final report format, and a **"Docs per role" table** (which extra docs each agent reads) | add as `docs/agents/project.md` |
| `Docs/Agents/glossary.md` | One line per project term (Module, Add-on, Run, Handoff, Gate, …) | add: RTP, ways, cascade, strip, recipe, RoundResult, override layer… |
| `Docs/Agents/handoff-format.md` | Exact sections of every run file (below) | add |
| `Docs/Agents/coding-standards.md` | Naming, structure, tests, R3 rules | have as `guides/programming/` |
| `Docs/Agents/ux-guidelines.md`, `quality-rubric.md` | For the UX reviewer and `/quality` | have as `guides/design/`; add a scoring rubric |
| `Docs/Features.md` | **Feature registry**: every toggle/experiment, status `Trying` / `Keep` / `Drop`, how to switch it (per level, editor, F1), run ids | add |
| `Docs/Tuning.md` | Values Josh can change himself | add |
| `Docs/Variants.json` | Registry of side-by-side alternatives (written only by the pipeline tool) | add; your multiplier variants A–D are the first slot |
| `Docs/RapidPro-Architecture.md` | Design doc + decisions; the planner flags contradictions | have (`FRAMEWORK_SPEC.md` decisions log) |
| `Docs/Wireframes/<set>/` | `wireframes.md`, `wireframes.json` (ids + percent rects), `wf-*.svg`; status Draft until Josh approves | add when you do screens; you already sketch layouts with feature numbers |

### 7.2 Agents (`.claude/agents/*.md`)

Every agent: reads `project.md` + its row in "Docs per role" first; writes **only** its one file in the run folder; never commits; ends every reply with a `## Process feedback` section (slowed me down / missing or unclear / one suggestion).

| Agent | Model | Tools | Job |
|---|---|---|---|
| planner | opus | read + write run file | Request → `01-spec.md`: goal, numbered testable acceptance criteria, where it lands (framework vs game), interface sketch, config and defaults, events, edge cases, out of scope, open questions marked **Blocking/Non-blocking with a default**, and a last line `Test scope: FULL` or `RELATED` (listing the test classes) |
| coder | sonnet | read, edit, bash | Implements the spec exactly, no more. Compiles, runs only the related tests. Stops and explains if the spec is wrong instead of redesigning. Writes `02-implementation.md` |
| tester | sonnet | read, edit, bash | One test per acceptance criterion + edge cases (empty, zero, max, repeated, out-of-order, cleanup). Never changes production code. Writes `03-tests.md` ending `TESTS: passed/total` |
| reviewer | opus | **read only** | `VERDICT: PASS / CHANGES_NEEDED`, Must fix (file:line, why, fix), Should fix, Good, **suggested commit message**. No tests run = CHANGES_NEEDED |
| triager | | read only | For `/quick`: `QUICK` or `ESCALATE`, likely cause, fix in ≤ 3 steps, regression test |
| researcher, game-designer | | | For `/pitch`: research brief → research → pitches → Josh picks |
| wireframer, ux-reviewer | | | For `/ui` and `/quality` |
| game-artist | | | For `/art` (slots already has `art-log` and the `image-prompting` skill: keep those) |

Your spec already names the Track 2 pipeline as **Planner → Coder (self-checks) → Josh tests → Tester → Josh commits**. That is RapidPro's play-first lane (7.3) plus `/feature-qa`, so the agents above fit it directly.

### 7.3 Slash commands (`.claude/commands/*.md`)

| Command | Stages | Use |
|---|---|---|
| `/feature <request>` | planner → coder → tester → reviewer, **max 2 fix loops**, then stop and hand over the Must-fix list | Big or risky work, anything touching the framework, save or rules |
| `/feature play-first: <request>` | planner (half page) → coder; tester and reviewer skipped, run marked "QA pending" | Feel, visuals, timing: Josh needs to see it before testing is worth it |
| `/feature experiment: <request>` | Lighter spec, feature behind a toggle that is **off by default**, filtered tests only, marked `Trying` | "Let me try this and see" |
| `/iterate <run> <change>` | Delta spec on top of the parent run (v2, v3…), inherits the lane. Reserved: `harden` (add full tests, mark Keep), `remove` (delete code, toggle, row) | Tweaks |
| `/feature-qa <run>` | One tester → reviewer pass over the whole play-first chain | When Josh is happy with how it plays |
| `/quick <bug>` | triager → coder (smallest fix + regression test) → reviewer, one fix loop; escalates to `/feature` | Small bugs |
| `/precommit` | Compile check, full suite, then every uncommitted run with its commit message and file count, overlap warnings | Before Josh commits a batch |
| `/ui`, `/art`, `/pitch`, `/quality` | Wireframes; art brief → **Generate? gate** → artist → **Import? gate**; research → pitches → pick; UX score | Non-code work |

### 7.4 Run folder and hand-off files

Each run lives in `.pipeline/runs/<run-id>/` with `run.json`, `events.jsonl` and:
`00-request.md` · `01-spec.md` (or `01-triage.md`) · `02-implementation.md` · `03-tests.md` · `changes.diff` + `changes.json` (exact files changed) · `04-review.md` (+ `04-review-loop<n>.md`) · `process-feedback.md`.

Every file starts with:
```
# <File title> — <run title>
Run: <run id> · Agent: <agent> · Date: <YYYY-MM-DD>
Status: Ready | Blocked | Partial
Summary: <one sentence>
```

### 7.5 Pipeline tool, hooks and dashboard (`.pipeline/`)

- `tools/pipeline.mjs` (Node CLI, "P"): `start`, `stage`, `handoff`, `gate` / `gate --resolve`, `diff`, `finish`, `list`, `status` (prints `STALLED` if a stage finished and nothing started), `variant list/add/update`, `qa`, `resume`.
- `tools/hook.mjs`: Claude Code hooks (PreToolUse, PostToolUse, UserPromptSubmit, Stop, Notification in `.claude/settings.json`) log every tool call and agent launch automatically, count tokens per run, and enforce the dashboard **Stop** button (denies tool calls with `STOPPED:` until the turn ends).
- `dashboard/server.mjs` + `index.html`: local page at http://localhost:4700 with runs, stages, hand-off files, gates, **Improvements** tab (process feedback), Variants.
- `PIPELINE.md`: the conductor rules. Key ones:
  - The main session is the **conductor**: subagents cannot launch subagents, so it launches each stage, logs it, and **never leaves a run idle** (start the next stage in the same turn a stage reports back).
  - Gates: ask Josh, record his answer, never guess past a gate.
  - **Busy engine**: if an agent stops because the editor is busy, open a gate asking Josh to free it, then re-run that agent.
  - Test scope: planner decides `FULL` or `RELATED`; `/precommit` is the safety net that makes RELATED safe.
  - Never commit, push, switch or delete branches. Never skip a stage silently (log `skipped` with a reason).
  - Final message: outcome in one line, files to commit, how to check by hand, commit message, anything waiting on Josh, a short "Play check" list for anything visual or audible, and a reminder to commit before the next run.

The Node tools are engine-agnostic and can be copied. What to change is in section 9.

### 7.6 Skills (`.claude/skills/`)

| Skill | What | Slots |
|---|---|---|
| `commit-message` | Josh's format (below) | copy as is |
| `unity-verify` | How to compile, test, run editor scripts, play-check and measure through the Unity CLI; full-suite gotchas | **rewrite** as `slots-verify`: `npm.cmd run check`, `npm.cmd run sim`, cocos-cli build, how to tell Cocos Creator is busy |
| `bug-check` | Project pitfalls list the triager and reviewer check against | add; seed it with slots pitfalls (client deciding outcomes, debug overrides leaking into `game.json`, stale `sync:cocos`) |
| `feature-discussion` | How to run a design discussion before code | copy |
| `mentor-review`, `idea-generate`, `wrap-up` | Review for learning; idea scoring rubric; end-of-session review | copy, adjust examples |
| `rapidpro-architecture` (Josh's account skill) | Fixed context + decisions for RapidPro design talks | make a `slots-architecture` skill with your spec's fixed context and decisions table |

### 7.7 How Josh wants every hand-off and report

Every module or run report ends with these, **in this order**:
1. **Commit message** in his format:
   ```
   ADDED|UPDATED|FIXED: <one-line summary, ~50 chars>
   - <change, lowercase verb, ~70 chars>
   - <2–6 bullets, no trailing period>
   ```
2. **Items to commit**: exact paths; what to leave out; flag unrelated changed files.
3. **How to check**: commands to run, expected counts, what to click/look at.
4. **Prompt rating**: `Prompt rating: N/10` plus one fix for the instructions you were given (Josh uses it to write better prompts).

Also:
- Show a rough **time estimate** (labelled a guess) on each step of a progress list.
- Update the **Work Status page** at the start, at every step, at blockers and at the end. Keep multi-line strings in its script escaped (`\n`); raw line breaks broke the page before.

### 7.8 Lessons from running it (keep these)

1. Never compile or run tests while the engine is busy (Unity Play Mode filled Josh's console with errors and blocked rounds). Check first; in the same message that says code is ready, ask Josh to stop the preview.
2. Never run a huge test suite in one call if the runner can hang; split it (Unity hung for 25+ minutes). Vitest is fast, so slots can run `npm run check` whole, but keep the rule for anything Cocos-side.
3. Bug briefs need a repro step and where it was seen. Performance asks need the build, device and the number that matters.
4. Confirm vague UI nouns in one line before removing anything.
5. Define project terms in one line in a brief.
6. Measure before optimising, with before/after numbers.
7. Do not claim something was passed to another session unless a tool confirmed it.
8. Never regenerate or overwrite hand-tuned assets Josh made; list them in `project.md` under "never touch".

---

## 8. Gap list (my read; verify against the repo)

| Piece | Slots today | Action |
|---|---|---|
| SOLID/MVC, config, framework/game split, never commit, hand-off, status page | In `CLAUDE.md`, spec, guides | keep |
| Prompt rating line in reports | Not in `CLAUDE.md` | add to the hand-off rule |
| `docs/agents/project.md` with "rules that never break" and "Docs per role" | Missing | add |
| Glossary, hand-off format, feature registry, tuning table, variants registry | Missing | add |
| Agents planner/coder/tester/reviewer/triager | Only `art-log` | add, adapted |
| Slash commands `/feature` (3 lanes), `/iterate`, `/feature-qa`, `/quick`, `/precommit` | Missing | add |
| `.pipeline/` tool, hooks, dashboard | Missing | copy and adapt |
| Verify skill | Missing | write `slots-verify` |
| Bug-check pitfalls list | Missing | add |
| Architecture skill for design talks | Missing | propose `slots-architecture` |
| Math simulation before math hand-off | Have | keep; make the tester run the RTP band check on any math change |

---

## 9. Setup steps for the slots project

Do these one at a time; each ends with the hand-off in 7.7. Ask Josh before copying anything from `D:\YT-Playables`; he may prefer to copy it himself.

1. **Docs for agents.** Create `docs/agents/project.md` (what the project is, where things live, how `math-core` → `game-logic` → views connect, rules that never break from your CLAUDE.md and spec, commands, final report format, Docs per role), `glossary.md`, `handoff-format.md`, plus `docs/FEATURES.md`, `docs/TUNING.md`, `docs/VARIANTS.json`.
2. **Agents.** Copy `planner`, `coder`, `tester`, `reviewer`, `triager` from `D:\YT-Playables\.claude\agents\`. Replace Unity specifics: paths, `unity command …`, `.meta` rules, asmdefs, Play Mode → slots commands, `sync:cocos`, "client never decides outcomes", "debug overrides never written to `game.json`", "run the sim before any math hand-off".
3. **Verify skill.** Write `.claude/skills/slots-verify/SKILL.md`: typecheck, tests, sim, `check:cocos`, Cocos build, how to detect and report a busy Cocos Creator, how to read results.
4. **Pipeline.** Copy `D:\YT-Playables\.pipeline\` **without** `runs/`, `queue/`, `precommit/`, `sessions.json`, `attention.json`. Then:
   - `config.json`: active game → `game-001`.
   - `.claude/settings.json` hooks: the command path is hard-coded to `D:/YT-Playables/.pipeline/tools/hook.mjs`; point it at the slots folder (`.pipeline/setup/install-claude-files.mjs` may do this; read it first).
   - `run-game-tests.sh` is Unity-only: replace with `npm.cmd run check` (+ sim band check).
   - `changes.mjs`: drop the `.meta` handling.
   - `PIPELINE.md`: swap Unity wording (Play Mode, unity-verify, `ArrowGameMode`) for slots terms.
5. **Commands.** Copy `feature.md`, `iterate.md`, `feature-qa.md`, `quick.md`, `precommit.md` (and `ui.md`, `pitch.md`, `quality.md` if Josh wants them). Keep your `/art` flow and `art-log`; merge rather than replace.
6. **CLAUDE.md.** Add the agent-pipeline block (commands, lanes, dashboard URL, verify skill) and the prompt-rating line.
7. **Skills.** Copy `commit-message`, `feature-discussion`, `wrap-up`; write `bug-check` with slots pitfalls; propose a `slots-architecture` skill to Josh.
8. **Dry run.** Run one small `/feature play-first:` (e.g. a settings toggle) end to end, check the dashboard shows every stage, then `/feature-qa` and `/precommit`. Fix what the process feedback says.

---

## 10. Where the source lives (Josh's PC)

| What | Path |
|---|---|
| Framework package + API README | `D:\YT-Playables\Packages\com.rapidpro.framework\` (`README.md`) |
| Project rules | `D:\YT-Playables\CLAUDE.md` |
| Agent docs | `D:\YT-Playables\Docs\Agents\` (`project.md`, `glossary.md`, `handoff-format.md`, `coding-standards.md`, `ux-guidelines.md`, `quality-rubric.md`) |
| Registries | `D:\YT-Playables\Docs\Features.md`, `Tuning.md`, `Variants.json` |
| Agents, commands, skills, hooks | `D:\YT-Playables\.claude\` (`agents\`, `commands\`, `skills\`, `settings.json`) |
| Pipeline tool, dashboard, rules | `D:\YT-Playables\.pipeline\` (`PIPELINE.md`, `pipelines.json`, `tools\`, `dashboard\`, `setup\`) |
| Architecture and decisions | `D:\YT-Playables\Docs\RapidPro-Architecture.md` |
| Level editor example | `D:\YT-Playables\Assets\Game\LevelMaker\ArrowLevelEditor.cs` |

Facts in this file come from reading those files on 2026-11-15. Re-read the originals before copying, since they may have changed.
