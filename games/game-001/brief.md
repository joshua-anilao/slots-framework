# Game 001 brief (working title)

| | |
|---|---|
| Status | Phase 1: math draft |
| Mechanics | 5x4, 1,024 ways, cascades, multiplier ladder (variant A), golden symbols → wild on reels 2-4, scatter free spins with retrigger, buy bonus |
| Reference | Genre-standard card cascade slots in the PH market. Original name, theme and art. |
| Targets | RTP 96.5%, medium-high volatility (index ~7), hit rate 30-45%, free spins 1 in 120-200 |
| Theme | TBD (placeholder symbols H1-H4 high, L1-L4 low, WILD, SC) |

## Math files

- `game.json`: the math (paytable values are multiples of the bet, per way).
- `strip-weights.json`: how many of each symbol per reel. Rebuild strips with `npx tsx tools/build-strips.ts games/game-001` (this overwrites `reelSets` in game.json).
- `reports/A/`: latest simulation for variant A.

## Decisions log

| Date | Decision |
|---|---|
| 2026-11-09 | Draft math v0.1.0 tuned to ~96.5% RTP. Max win seen ~1,000x in 10M rounds, so the 5,000x cap is not reachable in practice. |
