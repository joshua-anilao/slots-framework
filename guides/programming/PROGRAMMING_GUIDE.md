# Programming Guide

Applies to both tracks unless marked. Per-game differences go in `games/<id>/guides/programming.md`.

## 1. Principles

- **SOLID**, but readability for a mid-level dev wins any tie.
  - **S**: one job per class (`BetModel` holds bet state; it doesn't draw buttons).
  - **O**: new features are new modules; existing modules are not edited to add them.
  - **L**: any `ISpinService` (local or remote) can replace another.
  - **I**: small interfaces (`IBalanceService`, not one giant `IGameService`).
  - **D**: code depends on interfaces, wired in one place (the installer/bootstrap).
- **Config, not code.** Every number (bet levels, ladder, timings, win tiers, colors) lives in config. No magic numbers.
- **Plain names**, one public type per file, doc comments on public APIs, no clever reflection auto-wiring.
- Claude never commits. Every change ends with: commit message, files to commit, how to check.

## 2. MVC (shared M and C, per-engine V)

| Layer | Where | Rules |
|---|---|---|
| **Model** | `packages/game-logic` (pure TS) | State only, observable values (balance, bet, autospin count, multiplier). No drawing, no engine imports |
| **Controller** | `packages/game-logic` (pure TS) | Rules and flow (SpinFlow state machine, AutoSpinController, BuyBonusController). Talks to services and models |
| **View** | `prototype-web/` or `client-cocos/` | Draws and animates; forwards input to controllers. No game rules |

Because Models and Controllers are pure TS, **both tracks share them**. Track 2 only rebuilds Views. This is the biggest speed win for porting.

## 3. Feature modules (mix and match)

Each feature is a self-contained module so a new game is a **recipe**:

```json
// games/<id>/recipe.json
{
  "layout": "portrait-5x4",
  "math": "game.json",
  "features": ["cascade", "multiplierLadder", "goldenWild", "scatterFreeSpins",
               "buyBonus", "autoSpin", "turbo", "bigWin", "winFeed", "betHistory"]
}
```

A module contains: its math part (if any) in `math-core`, its model/controller in `game-logic`, a view per engine, a config block, and a README. Modules talk through an **event bus** and the Spin Result, never by reaching into each other. Adding a feature = adding a module + adding its id to a recipe.

Feature module catalog lives in `docs/FEATURE_CATALOG.md` (built up as modules are made).

## 4. Server-ready by design

All outside data comes through interfaces. Today each has a local implementation; later a remote one:

| Interface | Local (now) | Remote (later) |
|---|---|---|
| `ISpinService.spin(bet, opts)` | runs `math-core` in the browser | HTTP/WebSocket to RGS |
| `IWalletService` (balance) | demo balance in memory | operator wallet |
| `IHistoryService` | last N rounds in session | server history API |
| `IWinFeedService` (top ticker) | simulated feed, labeled demo | real wins from server |
| `IConfigService` | bundled `game.json` + debug overrides | server config |

Swapping = one line in the bootstrap. Views and controllers never change.

## 5. Platform: mobile and desktop web

- Portrait-first layout (designed at 720×1280), scales to fit any screen with letterboxing; safe areas for notches.
- Desktop: same portrait layout centered with a themed background filling the sides.
- Touch and mouse; spacebar = spin on desktop.
- Must work on mid-range Android Chrome and iOS Safari (latest 2 versions).
- Handle tab hidden / phone lock: pause audio, finish the current round's animation instantly on return.
- Handle orientation change and resize without reload.

## 6. Boot performance (< 5 s)

Budget measured on a mid-range Android phone over 4G, cold cache:

| Stage | Budget |
|---|---|
| First paint of loading screen | < 1.5 s |
| Ready to press Continue | < 5 s |
| First-load download | < 3 MB (HTML prototype < 1.5 MB) |

How:
- Load in two groups: **boot** (loading screen, main game atlas, core audio) and **lazy** (free spins, big win effects, buy bonus, history, rules) loaded in the background after Continue.
- Atlases compressed (WebP/AVIF for HTML; ASTC/ETC2 + WebP fallback for Cocos), audio as short compressed sprites.
- No blocking network calls before the loading bar.
- Measure every build; report boot time in the Tester's checklist.

## 7. Debug tool (both tracks)

- Opens with a hidden gesture (e.g. 5 taps on the version label) or `?debug=1`; stripped from release builds.
- Edits engine values through an **override layer**, session only, never writes to `game.json`.
- Force outcomes: next spin wins X, trigger free spins, force golden wild, force big/super/ultra win, set seed.
- Live stats: session RTP, spins, hits, features.
- Export overrides as JSON. "DEBUG OVERRIDES ACTIVE" banner when anything is changed.

## 8. Testing

- `math-core` and `game-logic`: unit tests (Vitest), seeded RNG, plus a sim RTP-band test.
- Each Coder hand-off passes: tests, sim RTP band, build, boot-time check.
- Every bug gets a repro (seed + steps) and a regression test.

## 9. Folder layout

```
Slots-Framework/
  FRAMEWORK_SPEC.md   PLAN.md
  docs/               MATH_ENGINE_GUIDE.md, SCREENS_AND_FEATURES.md, FEATURE_CATALOG.md
  guides/             programming/ art/ design/ (defaults)
  packages/
    math-core/        engine (pure TS)
    game-logic/       models + controllers (pure TS)
    simulator/        Node CLI
  prototype-web/      Track 1 (Vite + TS)
  client-cocos/       Track 2 (Cocos Creator 3.8)
  games/<id>/         game.json, recipe.json, brief.md, guides/, theme/, reports/
  templates/          starter recipes and configs
```

## 10. Track notes

- **Track 1 (HTML):** speed over polish; views can be rough. Still uses shared math-core and game-logic.
- **Track 2 (Cocos):** one prefab per screen, nested prefabs for shared parts, atlases per theme, Spine-ready symbol view (see art guide). Built and run on Josh's machine via cocos-cli.
