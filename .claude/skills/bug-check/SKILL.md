---
name: bug-check
description: Fast bug hunt on the Slots Framework's current TypeScript code (math-core, game-logic, prototype, Cocos client). Lists likely bugs ranked by severity, each with a concrete failure scenario and, where the logic is pure, a seeded unit-test idea. Use when Josh runs /bug-check or asks to check the current code for possible issues or bugs; the triager and reviewer agents check against its pitfalls list.
argument-hint: "[file | folder]  (default: uncommitted changes + the files they touch)"
---

# Bug Check

Direct, no Socratic questions: say what's broken or about to break. Keep it short.

## 1. Scope
- With an argument, check that file or folder.
- Otherwise check uncommitted `.ts` changes (`git status`, `git diff HEAD`), **plus the callers and callees of anything that changed**, across packages: a change in `packages/game-logic` reaches both `prototype-web` and `client-cocos`.
- Read files as they are now. Josh edits live.
- Skip `client-cocos/assets/shared/` and `generated/` (they are copies): check the source in `packages/*`, and just confirm `npm run check:cocos` passes.

## 2. Hunt: project pitfalls first

**Outcome and math**
- **The client deciding outcomes:** any `Math.random`, win calculation or "pick a result" in game-logic, prototype or Cocos views. Only math-core with the seeded RNG decides.
- **Unseeded randomness** in math-core or tests (`Math.random`, `Date.now`), so a round can't be replayed.
- **Ways math:** count = product of matching symbols per reel from the left; wilds counting on reel 1 when they shouldn't; scatter counted as a way symbol; `minWaysCount` off by one.
- **Cascades:** multiplier stepped before vs after the win is paid (check against `docs/MATH_ENGINE_GUIDE.md` and `multipliers.ts`); ladder not reset between base spins; variant C persisting when it should not (or the reverse); spots (D) not reset each free spin when `persistInFree` is false.
- **Golden cards:** only on the configured reels (0-based `golden.reels`), turn WILD only after they win, `wildRemovedAfterWin` respected.
- **Free spins:** retrigger adds `extraPerScatter`, total capped at `maxTotalSpins`; buy bonus charges the variant's price (`priceXByVariant`).
- **Max win cap:** applied to the round total including free spins, and the round ends when hit.
- **Floating point money:** totals compared with `===`; display rounding that differs from the wallet.

**Config and overrides**
- **Debug overrides leaking:** override layer written into `game.json`, or kept past the session.
- **Magic numbers:** timings, thresholds or colours in code instead of `pace.ts`, win tiers, `game.json` or the style file.
- A new config key read without a default, so an older `game.json` crashes.

**Shared code and Cocos**
- **Stale `sync:cocos`:** `packages/*` changed but `client-cocos/assets/shared/` not regenerated (`npm run check:cocos` fails), or someone edited the copy by hand.
- **Loose mode:** `[...set]`, spread of Map/Set iterators, `for (x of map.values())` / `.keys()` / `.entries()`: they silently do nothing in Cocos. Use `Array.from(...)`.
- **Engine imports** in math-core or game-logic (`cc`, DOM, `node:`), or the framework importing from a game folder or naming its symbols.
- Workspace imports (`@slots/...`) in Cocos code instead of the relative paths sync writes.
- Hand-made `.meta`, scene or prefab files.

**Flow and state**
- **Booleans instead of the state machine:** `isSpinning && !isFree` checks; a transition missing from the table; a change requested mid-change being queued instead of ignored.
- **Double taps:** spin, buy or auto start accepted while a round animates.
- **Auto spin stop conditions:** checked before the round settles, or ignoring free spins.
- **Pace:** waits not cancelled by `skip()`, so slam/turbo leaves timers firing into the next round; `hurry` not reset on the next round.
- **Subscriptions** on the event bus or observables never disposed when a view or window closes.
- **Interrupted rounds:** resume replays already-paid wins, or double-credits the wallet.

**Performance (mid-range phone)**
- Symbols, win labels or particles created per cascade instead of pooled; work every frame for cards that did not move; textures outside the atlas.

Then a general pass: undefined access, wrong conditions, leaks, anything that throws.

Only report issues tied to a **specific line and a concrete scenario** (seed + steps when possible). Drop anything speculative.

## 3. Report
```
## Bug Check — <scope>

**Bugs**
1. `file.ts:line` — <what's wrong>. <Scenario: seed/state → wrong result>.
   Test idea: <one line, seeded, for math-core or game-logic>
2. ...

**Risky / likely next bug** (optional, max 2)
- `file.ts:line` — <one line>

**Clean:** <one line on what was checked and looks fine>
```
Rank: wrong money or outcome, then crash, then wrong behaviour, then build issue, then leak. At most 6 bugs. Don't fix unless asked.
