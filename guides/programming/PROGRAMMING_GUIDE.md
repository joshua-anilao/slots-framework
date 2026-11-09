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

## 3. State machines (required)

Anything with steps or modes is a **state machine**, never a set of booleans (`isSpinning && !isFreeSpins && autoOn ...`).

- One generic `StateMachine<State, Event>` in `game-logic` (pure TS, shared by both tracks): a transition table, `enter`/`exit` hooks per state, guards, and a `stateChanged` event on the bus.
- Every state and every allowed transition is written in one table at the top of the file, so the flow can be read without running the game. A transition that is not in the table is a bug: it throws in dev and debug builds, and is logged and ignored in release.
- Views never decide flow. They listen to state changes and send events (`SPIN_PRESSED`, `SKIP`, `CONTINUE`), and the machine decides what happens.
- The debug panel shows each machine's current state and its last 20 transitions.
- Unit tests cover every row of each table, including the illegal moves.

Machines in a standard game:

| Machine | States |
|---|---|
| **Game** | Boot → Loading → Idle ⇄ Round; Idle → Window (any popup) → Idle; any → Offline → Idle |
| **Round** | Requesting → Spinning → Evaluating → Cascading (repeats) → FreeSpinsIntro → FreeSpins → FreeSpinsOutro → WinCelebration → Settled |
| **Auto spin** | Off → Running → Stopping (current round finishes) → Off |
| **Free spins** | Intro → Spinning → Retrigger → Spinning → Outro |
| **Window** (each popup) | Opening → Open → (Confirm step) → Closing → Closed |

Today the code has a simple `SpinModel.phase` (idle / requesting / presenting) plus a few flags. The first framework task after Phase 2 replaces these with the machines above, with no change in behaviour, before any new feature is built.

## 4. Two parts: framework and game

The code is split in two, and every file belongs to exactly one part.

| Part | What goes in | Where |
|---|---|---|
| **Framework** | Anything another game could use: math engine, game logic, state machines, services, and **prefabs** (ready-made features) | `packages/*` (shared TS), `prototype-web/src/framework/`, `client-cocos/assets/framework/` |
| **Game** | What only this game needs: its config, theme, recipe, and its own versions of framework features | `games/<id>/` (`game.json`, `recipe.json`, `theme/`, `web/`, `cocos/`) |

The rule of direction: **the game uses the framework; the framework never imports from a game.** Nothing in the framework may mention a game's name, symbols, or art.

### Prefabs (reusable features)

The framework holds a library of prefabs. A prefab is one feature, ready to drop into a screen, with its view, its logic hookup, its config block, and a short README (what it does, its config keys, its events, a screenshot). Starting list, from what the prototype already has:

| Prefab | Notes |
|---|---|
| Loading screen + tutorial carousel | pages from config, drag, arrows, dots, auto page, "Don't show next time" |
| Spin button | ring, shine, arrow speed tied to the drop speed, auto spin count and STOP |
| Auto spin button | tap = infinite, hold = options, pause icon while running |
| Turbo button | normal / turbo / super turbo |
| Bet button + Change Bet window | |
| Auto Spin window | counts and stop conditions from config |
| Buy Bonus window | price from config, confirm step |
| Multiplier bar | ladder from config, base and free spins look |
| Win box | count-up, fly-to-win target |
| Winner notice | needs a real `IWinFeedService` in production |
| Reels (card drop / scroll) | anticipation, cascades, gold to WILD |
| Free spins banners, Big / Super / Ultra win | |
| Menu: Settings, Game Rules (from config), Bet History | |
| Connection indicator + offline strip, interrupted round resume | |
| Modal, toast, touch effect, sound | |

A screen is then a **layout** (which prefabs, where) plus a **recipe** (which features are on), so a new game is mostly mix and match:

```json
// games/<id>/recipe.json
{
  "layout": "portrait-5x4",
  "math": "game.json",
  "theme": "theme/",
  "prefabs": ["loadingTutorial", "reels.cardDrop", "multiplierBar", "winBox", "spinButton",
              "autoSpinButton", "turboButton", "betWindow", "buyBonusWindow", "menu", "winnerNotice"]
}
```

### How a game changes a prefab (cheapest first)

1. **Config:** change values in the game's config (timings, text, ladder, colours).
2. **Theme:** swap art, sounds and fonts in `games/<id>/theme/`.
3. **Extend:** write a subclass or wrapper in the game part (`games/<id>/web/` or `games/<id>/cocos/`) that overrides one hook. The framework prefab is not edited (the O in SOLID).
4. **New:** a feature no prefab covers is written in the game part first.

### Promoting game code to the framework

- Work that is a variation of an existing feature stays in the game part until another game can use it.
- When something in a game looks reusable, **Claude asks Josh before moving it**, in one short message: what it is, which games could use it, and what it would cost to make it generic. Nothing is promoted without Josh's yes.
- On a yes, promotion means: remove anything game-specific, move every value to config, add tests, write the README, add a row to `docs/FEATURE_CATALOG.md`, and switch the original game to the framework version.
- The framework version must keep working in every game that already uses it. Adding to a prefab is fine; changing what it already does needs Josh's approval.

### Why this saves tokens (and time)

Claude pays for every line it reads and writes. With prefabs, a new game is a recipe, config and a theme. Claude reads the short catalog and the READMEs of the prefabs it needs, and writes a few hundred lines of JSON and glue code, not thousands of lines of screens. For example, the Auto Spin window, Buy Bonus window and loading screen took one full drop to build. Reusing them in a new game is a few lines of recipe plus config. Bugs fixed once in a prefab are fixed for every game, which also saves the tokens spent re-testing.

The savings depend on three things:
- **The catalog and READMEs stay short and true.** They are what Claude reads instead of the code. Each README stays under one screen and is updated in the same change as its prefab.
- **Making something generic costs extra the first time.** It pays back from the second game on, which is why promotion is a decision, not automatic.
- **A truly new mechanic still costs full price** the first time it is built.

## 5. Feature modules (mix and match)

Each feature is a self-contained module (its prefab is the view part, see section 4), so a new game is a **recipe**.

A module contains: its math part (if any) in `math-core`, its model/controller in `game-logic`, a view per engine, a config block, and a README. Modules talk through an **event bus** and the Spin Result, never by reaching into each other. Adding a feature = adding a module + adding its id to a recipe.

Feature module catalog lives in `docs/FEATURE_CATALOG.md` (built up as modules are made).

## 6. Server-ready by design

All outside data comes through interfaces. Today each has a local implementation; later a remote one:

| Interface | Local (now) | Remote (later) |
|---|---|---|
| `ISpinService.spin(bet, opts)` | runs `math-core` in the browser | HTTP/WebSocket to RGS |
| `IWalletService` (balance) | demo balance in memory | operator wallet |
| `IHistoryService` | last N rounds in session | server history API |
| `IWinFeedService` (top ticker) | simulated feed, labeled demo | real wins from server |
| `IConfigService` | bundled `game.json` + debug overrides | server config |

Swapping = one line in the bootstrap. Views and controllers never change.

## 7. Platform: mobile and desktop web

- Portrait-first layout (designed at 720×1280), scales to fit any screen with letterboxing; safe areas for notches.
- Desktop: same portrait layout centered with a themed background filling the sides.
- Touch and mouse; spacebar = spin on desktop.
- Must work on mid-range Android Chrome and iOS Safari (latest 2 versions).
- Handle tab hidden / phone lock: pause audio, finish the current round's animation instantly on return.
- Handle orientation change and resize without reload.

## 8. Boot performance (< 5 s)

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

## 9. Debug tool (both tracks)

- Opens with a hidden gesture (e.g. 5 taps on the version label) or `?debug=1`; stripped from release builds.
- Edits engine values through an **override layer**, session only, never writes to `game.json`.
- Force outcomes: next spin wins X, trigger free spins, force golden wild, force big/super/ultra win, set seed.
- Live stats: session RTP, spins, hits, features.
- State machines: current state of each machine and its recent transitions.
- Export overrides as JSON. "DEBUG OVERRIDES ACTIVE" banner when anything is changed.

## 10. Testing

- `math-core` and `game-logic`: unit tests (Vitest), seeded RNG, plus a sim RTP-band test.
- Each Coder hand-off passes: tests, sim RTP band, build, boot-time check.
- Every bug gets a repro (seed + steps) and a regression test.

## 11. Folder layout

```
Slots-Framework/
  FRAMEWORK_SPEC.md   PLAN.md
  docs/               MATH_ENGINE_GUIDE.md, SCREENS_AND_FEATURES.md, FEATURE_CATALOG.md
  guides/             programming/ art/ design/ (defaults)
  packages/           FRAMEWORK (shared by both tracks)
    math-core/        engine (pure TS)
    game-logic/       models, controllers, state machines, services (pure TS)
    simulator/        Node CLI
  prototype-web/      Track 1 (Vite + TS)
    src/framework/    FRAMEWORK: HTML prefabs (windows, buttons, reels, overlays)
    src/main.ts       loads a game's recipe and builds its screen
  client-cocos/       Track 2 (Cocos Creator 3.8)
    assets/framework/ FRAMEWORK: Cocos prefabs
  games/<id>/         GAME: game.json, recipe.json, brief.md, guides/, theme/, reports/
    web/              this game's own HTML views and extensions
    cocos/            this game's own Cocos views and extensions
  templates/          starter recipes and configs
```

## 12. Track notes

- **Track 1 (HTML):** speed over polish; views can be rough. Still uses shared math-core and game-logic, and follows the same framework / game split so prefabs can be ported to Cocos one to one.
- **Track 2 (Cocos):** framework prefabs in `assets/framework/`, the game's own in `games/<id>/cocos/`; nested prefabs for shared parts, atlases per theme, Spine-ready symbol view (see art guide). Built and run on Josh's machine via cocos-cli.
