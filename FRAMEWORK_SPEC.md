# Slots Framework: Spec and Workflow

**Status:** DRAFT v0.3 (2026-11-09). Waiting on Josh's approval. No code until approved.

**One line:** a reusable framework for prototyping slot games fast: swap a theme, a mechanic or a paytable through config, simulate the payout math headless, play it in a browser the same day, then build the real game in Cocos from the same math.

## Document map

| Doc | What |
|---|---|
| `FRAMEWORK_SPEC.md` | This file: goals, tracks, architecture, decisions |
| `PLAN.md` | Phased build plan |
| `docs/MATH_ENGINE_GUIDE.md` | Slot math explained for a new PM; how one engine serves both tracks |
| `docs/SCREENS_AND_FEATURES.md` | Standard game v1: screens, features, modules |
| `guides/programming/` | SOLID, MVC, modules/recipes, server-ready interfaces, boot budget, debug tool |
| `guides/art/` | General look, atlases, naming, Spine readiness |
| `guides/design/` | General feeling: pacing, win tiers, juice, sound, UX |
| `games/<id>/guides/` | Per-game overrides of the three guides (only the differences) |

---

## 1. Goals

1. **Fast prototypes.** Idea to playable HTML prototype in hours.
2. **Fast production.** New Cocos game on the framework in days, by mixing existing feature modules ("recipes").
3. **Config, not code.** Math, features, bet levels, pacing, win tiers, theme assets in data.
4. **Math you can trust.** Every game simulated (millions of spins) with an RTP/volatility report.
5. **Market-relevant.** PH market style (JILI, PG Soft, Fa Chai). Original names and art.
6. **Re-skinnable.** Atlases with fixed frame names; Spine-ready.
7. **Server-ready.** Spin results, wallet, history and win feed behind interfaces.

## 2. The two tracks

| | Track 1: Prototype | Track 2: Production |
|---|---|---|
| Purpose | Experiment on mechanics, themes, payouts | Real game on reusable framework |
| Tech | HTML5 + TypeScript (Vite), no Cocos | Cocos Creator 3.8 (TypeScript) |
| Views | Throwaway, cheap | Polished, reusable prefabs |
| Shared | `math-core`, `game-logic` (Models + Controllers), `game.json`, simulator | same |
| Process | Claude builds, Josh plays | Planner → Coder (self-checks) → Josh tests → Tester → Josh commits |

**Graduation gate (1 → 2):** sim meets targets, Josh signs off on feel, any new mechanic exists in `math-core` with tests.

## 3. Target and platform

| Item | Decision |
|---|---|
| Market | Philippines, ₱ PHP, English (Tagalog later via strings table) |
| Platform | Mobile web + desktop web (HTML5) |
| Orientation | Portrait first (720×1280 design), desktop shows portrait centered |
| Boot | < 5 s to Continue on mid-range Android over 4G |
| Purpose | Internal testing + demos; demo balance only, no real money |

## 4. Architecture

```
games/<id>/  game.json · recipe.json · theme/ (atlases, audio) · guides/
        │
packages/math-core   (pure TS) RNG · reels · ways · cascade · multiplier · golden wild
        │                       · free spins · buy bonus · override layer → SpinResult
packages/game-logic  (pure TS) Models + Controllers: wallet, bet, spinFlow, autoSpin, ...
        │            service interfaces: ISpinService, IWalletService, IHistoryService,
        │                                IWinFeedService, IConfigService
        ├──────────────► prototype-web/  (Views, HTML)
        └─ sync:cocos ─► client-cocos/   (Views, Cocos prefabs)
packages/simulator   (Node) runs math-core millions of times → report + PAR sheet
```

Rules: the client never decides outcomes; math-core and game-logic have no engine imports; seeded RNG for replay; services swap local → remote in one place.

## 5. Standard game v1 (first game: "Game 001", name TBD)

5x4, 1,024 ways, cascades, cascading multiplier (variants A–D to try), golden symbols → wild, scatter free spins with retrigger, buy bonus, auto spin, turbo/super turbo, Big/Super/Ultra win, winner ticker, marquee, connection strength, bet history, loading + tutorial carousel, settings + game rules, debug panel. Full detail: `docs/SCREENS_AND_FEATURES.md`.

Modelled on Super Ace's genre-standard mechanics and screen structure; **our own name, theme, logo and symbol art**.

## 6. Math targets (Game 001 defaults)

RTP 96.5% (±0.5% at 10M spins; tighter needs 100M+ rounds), medium volatility, max win cap 5,000x (draft math reaches ~1,000x), free spins ~1 in 120–200, buy bonus price 50x with RTP ≈ game RTP. Explained in `docs/MATH_ENGINE_GUIDE.md`.

## 7. Debug tool (both tracks)

Session-only override layer on top of `game.json` (never written back), force outcomes, set seed, live session stats, export overrides as JSON, "DEBUG OVERRIDES ACTIVE" banner, stripped from release builds.

## 8. Tooling

Node + TypeScript, npm workspaces, Vite (Track 1), Cocos Creator 3.8 + official cocos-cli on Josh's machine via Remote Control (Track 2), Vitest, Git. Claude never commits; each hand-off includes commit message, files, how to check.

## 9. Out of scope (for now)

Real-money wallet, accounts, certification (GLI/BMM), operator integration, live/streamed slots, perya games.

## 10. Decisions log

| # | Decision | By / date |
|---|---|---|
| 1 | Math engine is engine-agnostic pure TS | proposed |
| 2 | Cocos Creator 3.8 for production, PixiJS fallback | proposed |
| 3 | Client plays back SpinResult; never decides outcomes | proposed |
| 4 | Two tracks: HTML5 prototype and Cocos production | Josh, 2026-11-09 |
| 5 | math-core, game-logic (M+C), config, simulator shared by both tracks; Cocos gets them via `sync:cocos` | proposed |
| 6 | Track 2 pipeline: Planner → Coder (self-checks) → Josh tests → Tester → Josh commits | Josh, 2026-11-09 |
| 7 | SOLID + MVC; features as mix-and-match modules; games defined by recipes | Josh, 2026-11-09 |
| 8 | Guides folders (programming/art/design) with per-game override files | Josh, 2026-11-09 |
| 9 | Art in atlases with fixed frame names; Spine-ready SymbolView | Josh, 2026-11-09 |
| 10 | Debug overrides are session-only | Josh, 2026-11-09 |
| 11 | Standard game = Super Ace-style mechanics/layout with original theme and art | Josh, 2026-11-09 (originality: proposed) |
| 12 | Portrait first, boot < 5 s | Josh, 2026-11-09 |
| 13 | Cascading multiplier: start with variant A (fixed ladder x1-x2-x3-x5, free spins x2-x4-x6-x10); B-D stay switchable in debug | Josh, 2026-11-09 |
| 14 | Feature numbers are permanent; layouts are sketched with feature numbers (SCREENS_AND_FEATURES section 8) | Josh, 2026-11-09 |

## 11. Open questions

1. Cocos Creator and Node versions installed?
2. Max win cap for Game 001 (default 5,000x)?
3. Theme/name idea for Game 001, or should Claude propose 3?
4. Art: your artists, bought packs, or AI placeholders first?
5. Haptics on big wins: yes/no?
6. GitHub repo for this, or local Git only for now?
