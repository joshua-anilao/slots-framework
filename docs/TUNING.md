# Tuning table

Values Josh can change by hand without a pipeline run. Change, then check as the last column says. **Any math value change needs a sim run before it is kept** (`npm.cmd run sim -- games/game-001 --spins 10000000`, RTP must stay 96.5% ± 0.5%).

The coder adds a row whenever it adds a tunable.

## Math (`games/game-001/game.json`): needs sim
| Key | Now | Range / options | What it feels like |
|---|---|---|---|
| `multiplier.variant` | `A` | A, B, C, D | Ladder rules; B–D more swingy |
| `multiplier.A.base` / `.free` | `[1,2,3,5]` / `[2,4,6,10]` | rising steps | Bigger steps = bigger cascades, higher volatility |
| `multiplier.payScale.<v>` | A 1, B 1, C 1.01, D 0.83 | ~0.7–1.2 | Scales all pays for that variant to hit RTP |
| `golden.chanceBase` / `chanceFree` | 0.08 / 0.3 | 0–1 | More gold cards = more wilds after wins |
| `golden.reels` | `[1,2,3]` (reels 2–4) | 0–4 | Which reels can show gold cards |
| `freeSpins.minScatters` | 3 | 3–5 | Lower = free spins more often |
| `freeSpins.spins` / `extraPerScatter` | 10 / 2 | | Length of the bonus |
| `freeSpins.maxTotalSpins` | 100 | | Retrigger ceiling |
| `buyBonus.priceX` / `priceXByVariant` | 50 / B 51.5, C 48.2, D 60 | | Buy price in bets; set so buy RTP ≈ game RTP |
| `maxWinX` | 2000 | | Cap per round, × bet |
| `maxCascades` | 100 | | Safety limit |
| `symbols[].pays` | see file | | Pay per way, × bet |
| `strip-weights.json` | see file | | Symbol counts per reel; rebuild with `npx.cmd tsx tools/build-strips.ts games/game-001` (overwrites `reelSets`) |

## Bets (`game.json`): no sim needed
| Key | Now | Notes |
|---|---|---|
| `bet.levels` | 1 2 3 5 10 20 50 100 200 500 | ₱; − / + wraps around |
| `bet.defaultIndex` | 4 (₱10) | |

## Pacing (`packages/game-logic/src/presentation/pace.ts`, `TIMINGS`): ms, then `npm.cmd run sync:cocos`
| Field | Normal / Turbo / Super | What it is |
|---|---|---|
| `clear` | 200 / 120 / 80 | Old cards fall out |
| `cardFall` | 300 / 180 / 120 | One card falling in |
| `cardStagger` | 40 / 20 / 10 | Between cards in a reel |
| `reelStagger` | 90 / 45 / 20 | Between reels |
| `firstStop` / `stopGap` | 600, 150 / 300, 75 / 150, 38 | Scroll style only |
| `anticipation` | 600 / 250 / 0 | Per remaining reel when 2 scatters landed; 0 = off |
| `highlight` | 1000 / 450 / 300 | Winning cards glow |
| `pop` | 400 / 200 / 110 | Winning cards burst |
| `drop` | 300 / 200 / 100 | Refill after a cascade |
| `wildReveal` | 300 / 140 / 70 | Gold card flips to WILD |
| `stepPause` | 200 / 50 / 20 | Breath between cascade steps |
| `scatterCelebrate` | 2000 / 1000 / 500 | Scatters pulse before free spins |
| `banner` | 2200 / 1300 / 800 | Free spins intro / outro |
| `countUp` | 4000 / 2000 / 1100 | Big win and FS total count-up |

## Win tiers (`packages/game-logic/src/models/winTiers.ts`, `DEFAULT_WIN_TIERS`): × bet, then `sync:cocos`
| Field | Now |
|---|---|
| `big` / `super` / `ultra` | 10 / 25 / 50 |

## Look (Cocos, `client-cocos/assets/game/boardStyle.ts`): Creator recompiles on save
| What | Now |
|---|---|
| Card accent colour per symbol (`ACCENT`) | H1 #c2410c … L4 #65a30d |
| WILD / SCATTER card fill and ring | gold #f2b705, red #be123c |
| Art scale on card | 0.88 normal, 0.72 WILD/SC |

**Note:** pacing and win tiers live in code today, not in `game.json`. Moving them to config is a candidate framework task.
