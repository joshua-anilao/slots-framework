# Math Engine Guide (for Product Managers)

**Who this is for:** someone new to slot math. No coding needed to read it.
**What it covers:** what the math engine is, the words you'll hear (RTP, volatility, hit rate…), how a spin is decided, how our cascade game works, how we test the math, and how the HTML prototype and the Cocos game both use the same engine.

---

## 1. What the math engine is, in one paragraph

The math engine is a **calculator that decides every spin**. You give it a bet, it rolls random numbers, picks which symbols land, works out every win, runs cascades and features, and hands back a **Spin Result**: a plain list of "what happened". The game screen (HTML or Cocos) never decides anything; it only **plays back** that list with animations. That separation is how real slot companies work, and it means we can test the math without any graphics at all.

```
 Bet ₱10 ──► [ MATH ENGINE ] ──► Spin Result ──► [ GAME SCREEN ] ──► animations
              random numbers        "reel stops,       plays it back
              + rules from          wins, cascades,
              game.json             total ₱42.50"
```

## 2. The words you'll hear

| Term | Plain meaning | Typical value |
|---|---|---|
| **RTP** (Return to Player) | Out of every ₱100 bet over millions of spins, how much goes back to players | 96–97% |
| **House edge** | 100% − RTP. The game's long-run profit | 3–4% |
| **Hit frequency** | How often a spin wins anything | 25–45% (cascade games are high) |
| **Volatility** | How "swingy" wins are. Low = many small wins. High = long dry spells, rare big wins | Shown as peppers/lightning on the loading screen |
| **Max win** | Biggest possible win, as a multiple of bet. The engine caps wins here | 1,500x – 10,000x |
| **Feature frequency** | How often free spins trigger | 1 in 100 – 1 in 250 spins |
| **Reel strip** | The long list of symbols on each reel. A spin picks a random stop position on each strip | 40–120 symbols per reel |
| **Paytable** | How much each symbol combination pays | e.g. 5 Aces = 2x bet |
| **Ways** | Instead of fixed lines, any left-to-right adjacent match pays. 5 reels × 4 rows = 4×4×4×4×4 = **1,024 ways** | |
| **Cascade / tumble** | Winning symbols vanish, new ones drop in, can win again in the same spin | |
| **Multiplier ladder** | Each cascade in a row raises the win multiplier (x1 → x2 → x3 → x5) | |
| **Scatter** | Symbol that pays/triggers anywhere on screen, no adjacency needed | 3+ = free spins |
| **Wild** | Substitutes for other symbols | |
| **Buy bonus** | Pay a fixed price (e.g. 50x bet) to jump straight into free spins | Price set so its RTP ≈ game RTP |
| **PAR sheet** | The official spreadsheet describing a game's math (symbols, strips, paytable, RTP breakdown) | |
| **RNG** | Random Number Generator. The source of every random choice | |
| **Seed** | The starting number of the RNG. Same seed = same spins. Used to replay bugs | |

### RTP is a long-run average, not a promise per session
A 96% game can return ₱0 in one session and ₱5,000 in another. RTP only shows up over **millions** of spins. That's why we **simulate**.

### Volatility in one picture
```
Low volatility:   ▂▃▂▃▂▃▂▃▂▃▂▃   steady, small
High volatility:  ▁▁▁▁▁▁█▁▁▁▁▁   quiet... then BIG
```
Same RTP, very different feel. Volatility is the main lever for "how the game feels".

## 3. How one spin is decided (our cascade game)

This is the standard mechanic set for our first game (genre-standard for 5x4 cascade "card" slots in the PH market).

1. **Bet** ₱10 is taken from balance.
2. **Pick stops:** for each of the 5 reels, RNG picks a random position on that reel's strip; the 4 symbols from there land.
3. **Evaluate ways:** for each symbol, count matches on reel 1, 2, 3… left to right (need 3+ adjacent reels). Ways = product of matches per reel.
   *Example:* Kings on reel 1 (×1), reel 2 (×2), reel 3 (×1) = 1×2×1 = 2 ways of "3 Kings". If 3 Kings pays 0.3x bet, win = 2 × 0.3 × ₱10 = ₱6.
4. **Apply multiplier:** first win in a spin is x1.
5. **Golden symbols:** some symbols on middle reels can be "golden". If a golden symbol is part of a win, instead of disappearing it **turns into a Wild**.
6. **Cascade:** winning symbols are removed, symbols above fall, new ones drop in from the strip. Evaluate again.
7. **Multiplier goes up** on each cascade: base game x1 → x2 → x3 → x5 (stays at x5). In free spins: x2 → x4 → x6 → x10.
8. Repeat until no new win. **Total win** is added to balance.
9. **Scatters:** 3+ scatters anywhere = free spins (e.g. 10, +2 per extra scatter). Free spins can retrigger.

All the numbers above (ladder values, free spin counts, which reels can be golden, scatter count) live in `game.json`, so we can try other versions without code.

### What the engine returns (Spin Result, simplified)
```json
{
  "bet": 10,
  "steps": [
    { "grid": [["Q","K","A","J"], …], "wins": [{"symbol":"K","ways":2,"pay":6}], "multiplier": 1 },
    { "grid": […], "wins": [{"symbol":"A","ways":4,"pay":12}], "multiplier": 2, "goldenToWild": [[2,1]] }
  ],
  "scatterCount": 1,
  "featureTriggered": null,
  "totalWin": 30
}
```
The game screen walks through `steps` one by one: show grid → highlight wins → pop symbols → drop new ones → bump multiplier → next step.

## 4. How we know the math is right: simulation

Before anyone plays, the **simulator** runs the engine millions of times (no graphics, takes seconds to minutes) and produces a report:

| Report line | What you check |
|---|---|
| RTP total | Within target ± 0.5% after 10M spins (the report shows the confidence range; ±0.1% needs 100M+ spins) |
| RTP split: base / free spins / buy bonus | Free spins often 30–45% of RTP in this genre |
| Hit frequency | Feels "busy" enough? |
| Free spins frequency | e.g. 1 in 180 |
| Average free spins win | e.g. 60x bet |
| Win distribution | % of spins winning 0x, <1x, 1–5x, 5–20x… |
| Max win seen / hit rate of max cap | Is the cap reachable but rare? |
| Session sim | "₱1,000 at ₱10 bet lasts ~X spins on average" |
| Buy bonus RTP | Should be close to the game RTP |

**Tuning levers** (what you change when numbers are off):
- **Paytable values** → raises/lowers all wins of that symbol.
- **Reel strips** (how many of each symbol) → changes hit rate and feature frequency.
- **Golden symbol chance** → more wilds, more cascades.
- **Multiplier ladder** → changes how much long cascades pay; strong volatility lever.
- **Scatter count on strips** → feature frequency.
- **Max win cap**.

## 5. Debug tool: changing values safely

Both the HTML prototype and the Cocos game get a **debug panel** that edits engine values **for the current session only**:

- You change, say, the x5 ladder step to x8, or force "trigger free spins next spin".
- The engine uses an **override layer** on top of `game.json` held in memory. The real `game.json` file is never changed.
- Refresh the page = back to the real values.
- An **Export overrides** button saves your tweaks as a small JSON file, so if you like them you can send them to be made permanent (through the normal review + simulation).
- A banner shows **"DEBUG OVERRIDES ACTIVE"** whenever anything is changed, so nobody mistakes a tweaked game for the real one.
- The debug panel is removed from release builds. When a real server decides spins, the panel can only ask for test outcomes if the server allows it.

## 6. One engine, two games (HTML prototype and Cocos)

You asked how one TypeScript engine can be used by both. Here's how:

**The engine is pure TypeScript with zero graphics code.** It doesn't know about HTML, Canvas or Cocos. It's like a calculator app's logic separated from its buttons. Any program that runs TypeScript/JavaScript can call it, and both a web page and Cocos Creator run TypeScript.

```
Slots-Framework/
  packages/
    math-core/          ← THE ENGINE (one copy, pure TS, has its own tests)
    game-logic/         ← shared Models + Controllers (balance, bet, autospin, spin flow)
    simulator/          ← runs math-core millions of times in Node
  prototype-web/        ← HTML prototype: imports math-core directly
  client-cocos/         ← Cocos game: gets math-core copied in by a sync script
```

- **HTML prototype** (Vite) imports it directly: `import { SlotEngine } from '@slots/math-core'`.
- **Cocos Creator** only compiles scripts inside its own `assets/` folder. So a one-command script `npm run sync:cocos` copies the engine into `client-cocos/assets/scripts/shared/math-core/`. That copy is **read-only by rule**; you only ever edit the original in `packages/math-core`. A check fails the build if the copy is out of date.
- **Simulator** runs it in Node.

So a mechanic proven in the prototype is the *exact same code* in Cocos. Only the visuals are rebuilt.

**Future real server:** a real server would run this same engine (Node) and send the Spin Result over the network. The game asks a `SpinService` for results; today that service is the local engine, tomorrow it's an HTTP call. The game screens don't change.

## 7. Common questions a slot PM gets (with answers)

These are not open questions; each line is the question people will ask you, followed by the answer to give.

- **"Is the game fair?"** Every outcome comes from the RNG and the reel strips; the client never fakes results. Real-money launch needs certified RNG and math (labs like GLI/BMM). Out of scope for prototypes but our structure is ready for it.
- **"Can we show near-misses?"** Outcomes must come from the math, not be staged. Animations can build suspense (slow reel on 2 scatters) but must not change the result.
- **"Can we change RTP per operator?"** Yes, by shipping multiple configs (e.g. 94%, 96%, 97%) of the same game. Each gets its own simulation report.
- **"Why is my session RTP 70%?"** Short sessions vary a lot. Check the sim's session distribution.

## 8. Glossary of files

| File | What it is |
|---|---|
| `games/<id>/game.json` | All math for one game: symbols, strips, paytable, ladder, features, bet levels |
| `games/<id>/reports/` | Simulator output (HTML report + CSV PAR sheet) |
| `packages/math-core/` | The engine code |
| `packages/simulator/` | `npm run sim -- games/<id> --spins 10000000` |
