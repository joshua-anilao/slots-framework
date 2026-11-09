# Build Plan

**Status:** proposed 2026-11-09, waiting on Josh's approval. Nothing is built until approved.

Goal of v1: a **standard game** (5x4, 1,024 ways, cascades, multiplier ladder, golden wilds, scatter free spins, buy bonus, full screen set) built once on the framework, so every later slot is a recipe: "make a version with these features and this layout sketch".

## Phases

| Phase | What | Track | Done when | Josh's role |
|---|---|---|---|---|
| **0. Docs** | Spec, math guide, guides, screens/features, this plan | — | Josh approves | Review, answer open questions |
| **1. Shared core** | Repo + npm workspaces; `math-core` (RNG, reels, ways, cascade, multiplier ladder variants A–D, golden wild, scatter free spins, buy bonus, max-win cap, override layer); `game-logic` (models + controllers: wallet, bet, spinFlow, autoSpin, speed, buyBonus, history); `simulator` (HTML report + CSV PAR sheet); tests | shared | Tests pass; Game 001 config sims to 96.5% ± 0.5% at 10M spins | Read the sim report |
| **2. HTML prototype** | `prototype-web`: all screens in `SCREENS_AND_FEATURES.md` with placeholder theme; debug panel; boot < 5 s | 1 | Every v1 feature playable on phone + desktop | Play it on your phone, give feedback |
| **3. Tune** | Try multiplier variants A–D, volatility, pacing, win tiers; pick defaults | 1 | Josh signs off feel + math (graduation gate) | Choose the multiplier variant and feel |
| **4. Cocos framework core** | `client-cocos`: bootstrap + services, MVC views wired to shared `game-logic`, screen manager, asset/atlas loader (boot vs lazy groups), audio, SymbolView (sprite + Spine-ready), debug panel, `sync:cocos` script; cocos-cli build | 2 | Empty game boots < 5 s on phone; tests + build green | Test each module (Planner → Coder → you → Tester) |
| **5. Cocos standard game** | All v1 screens and features as Cocos views; placeholder theme | 2 | Feature parity with prototype; Tester pass | Test, then commit |
| **6. Re-skin proof** | Second theme (new atlases, same frame names) on the same math | 2 | Re-skin done in ≤ 1 day, no code changes | Pick a theme |
| **7. Recipes** | `templates/` + `FEATURE_CATALOG.md`: build a variant from a recipe + layout sketch | both | A new variant built from a recipe with only new modules coded | Send a sketch + feature list |

## Phase 1 detail (first build step once approved)

1. Repo scaffold: `packages/math-core`, `packages/game-logic`, `packages/simulator`, `games/game-001/`, Vitest, TS strict.
2. `math-core`: seeded RNG → reel strips → ways evaluator → cascade loop → multiplier ladder → golden wild → scatter/free spins → buy bonus → max-win cap → Spin Result format → config override layer.
3. `game-001/game.json`: first-draft strips + paytable aimed at 96.5% RTP, medium-high volatility.
4. `simulator`: `npm run sim -- games/game-001 --spins 1000000` → `reports/` HTML + CSV.
5. `game-logic`: models + controllers + service interfaces with local implementations.

Each step ends with: commit message, files to commit, how to check.

## Risks and how we handle them

| Risk | Handling |
|---|---|
| Hitting exact RTP is fiddly | Simulator first; tune strips with report; later a helper that suggests strip changes |
| Cocos can't import code outside `assets/` | `sync:cocos` copies shared packages in; build check fails if copy is stale |
| Boot > 5 s on low-end phones | Boot/lazy asset groups, compressed atlases, measured every build |
| Art not ready | Placeholder theme with the same frame names |
| Scope creep in v1 | Anything not in `SCREENS_AND_FEATURES.md` goes to a later recipe |
