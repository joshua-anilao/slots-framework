# @slots/math-core

The math engine. Pure TypeScript with no DOM, Node or Cocos imports, so the same code runs in the simulator, the HTML prototype, Cocos and a future game server.

```ts
import { SlotEngine, SeededRng } from '@slots/math-core';
const engine = new SlotEngine(gameConfig, new SeededRng(1234));
const round = engine.playRound({ bet: 10 });            // normal spin
const bought = engine.playRound({ bet: 10, buyBonus: true });
```

`playRound` returns a `RoundResult`: base spin, free spins, and for every spin a list of cascade `steps` (grid, wins, multiplier, removed cells, golden-to-wild cells). The game screen plays these steps back; it never decides outcomes.

## What's inside

| File | Job |
|---|---|
| `config.ts` | `GameConfig` type: everything in `game.json` |
| `result.ts` | `RoundResult` / `SpinOutcome` / `CascadeStep`: the playback script |
| `seededRng.ts` | Seeded RNG for replay and simulation (not certified for real money) |
| `waysEvaluator.ts` | 1,024-ways wins, wilds substitute, scatters never pay |
| `reelState.ts` | Reel stops, grid, gravity refill from the strip |
| `multipliers.ts` | Cascading multiplier variants A (ladder), B (endless), C (persistent in free spins), D (spots) |
| `spinRunner.ts` | One spin: evaluate → pay → golden to wild → remove → refill → repeat |
| `slotEngine.ts` | One round: base spin or buy, free spins, retriggers, max-win cap, debug force |
| `overrides.ts` | Session-only overrides for the debug panel (never touches the original) |
| `validateConfig.ts` | Clear errors for a broken `game.json` |

## Rules

- No engine imports. If it needs the screen, it doesn't belong here.
- Every random choice goes through `IRng`.
- Money is exact inside a round; only the round total is rounded to cents.
- Changing math? Run the tests and the simulator, and commit the new report with the change.
