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
| 2026-11-10 | Max-win cap set to 2,000x (was 5,000x). 10M rounds: RTP 96.50%, hit 38.54%, free spins 1 in 140, buy bonus RTP 95.56% at 50x. Buy price stays 50x. Theme direction: Pinoy street food (name pending). |
| 2026-11-10 | Variants B to D tuned to the RTP target (10M rounds each, shared paytable and strips). Pay scale per variant (`multiplier.payScale`): A 1, B 1, C 1.01, D 0.83. C free spins ladder x2 x4 x5 x6 (persistent). D spot cap 16 and spots reset every free spin (`persistInFree: false`). Buy price per variant (`buyBonus.priceXByVariant`): A 50, B 51.5, C 48.2, D 60. Results: A 96.50% / buy 95.4%, B 96.82% / 96.5%, C 96.34% / 96.6%, D 96.81% / 97.0%. D is the most volatile (about 41% of RTP in free spins). |
