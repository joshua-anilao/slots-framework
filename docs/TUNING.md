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
| `goldBank.enabled` | false | true/false | Badges on golden cards add to the multiplier |
| `goldBank.badgeChanceBase` / `badgeChanceFree` | 0.15 / 0.30 (plan values, unchanged) | 0–1 | How often a golden card carries a badge |
| `goldBank.valuesBase` / `valuesFree` | base x2 x3 x5 x10 (50/30/15/5); free x2 x3 x5 x10 (50/30/15/2) | `v` ≥ 2, `w` > 0 | Badge sizes and how common each is. Free spins values were lowered from the plan to keep cap hits under 1 in 1M in carry mode |
| `goldBank.carryInFree` | false | true/false | Bank keeps growing through the whole free spins feature |
| `goldBank.tuning.reset.payScale` / `.carry.payScale` | 0.7935 / 0.6562 | ~0.5–1 | Scales all pays when the bank is on, to hold RTP (carry needs the lowest) |
| `goldBank.tuning.reset.buyPriceX` / `.carry.buyPriceX` | 58.2 / 71.6 | | Buy price when the bank is on |
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

## Character (prototype, `prototype-web/src/framework/character/characterReactions.ts`, `DEFAULT_CHARACTER_CONFIG`; a theme may override): no sim needed
| Field | Now | What it does |
|---|---|---|
| `smallWinMinX` | 0 | Win of at least this × bet makes the character cheer. 0 = any win; higher = small wins get no reaction |
| `reactToLoss` | true | Character reacts to every losing spin (short clip). false = silent on a loss |
| `clipMs.idle` / `clipMs.bonus` | 2400 / 800 | Loop length of the breathing clip / the free spins loop |
| `clipMs.smallWin` / `bigWin` | 1200 / 2400 | One-shot lengths |
| `clipMs.lose` / `nearMiss` | 900 / 1400 | One-shot lengths |
| `introMs` | 600 | The character rises in over this long after Continue |
Clip times do not scale with turbo. Puppet poses (angles, hop heights) live in `puppetRig.ts` `PUPPET_CLIPS`; blend into a loop is `BLEND_MS` 180.

## Layout (prototype, 720 x 1280)
Pick with the URL: `?layout=classic` (default, the original layout, `styles.css`) or `?layout=stage` (character stage, `layout-stage.css`). Default is `DEFAULT_LAYOUT` in `prototype-web/src/main.ts`.

Stage layout rows in design px (all are CSS variables on `.layout-stage` at the top of `layout-stage.css`; v4 reference proportions):
| Row | Now |
|---|---|
| Character stage (`--stage-h`) | 340 (about 27%; logo centred, its bottom edge on the seam, 400 wide (`--stage-logo-w`), `logo-main` 52 px) |
| Multiplier bar + winner notice (`--stage-mult-h`) | 50 (steps 40 tall, 698 wide = `--stage-row-w`) |
| Gap (`--stage-gap-board`) | 6 |
| Reel frame | 656 (cells 130 x 158, padding 9, border 3, 698 wide) |
| Gap (`--stage-gap-strip`) | 8 |
| Banner strip (`--stage-strip-h`), marquee / WIN pill | 44 (pill 608 wide, Buy Bonus badge beside it) |
| Gap (`--stage-gap-controls`) | 6 |
| Controls (`--stage-controls-h`) | 136 (circles `--stage-ctl-size` 72 + caption, Spin `--stage-spin-size` 128 plus its 8 px ring) |
| Gap (`--stage-gap-footer`) | 0 |
| Footer (`--stage-footer-h`) | 34 |
Total 1280. The Buy Bonus badge (80) hangs from the strip's top edge down over the gap above the controls; the circles sit at the bottom of the controls row so they stay 8 px or more under it.

| Variable | Now | What it does |
|---|---|---|
| `--stage-buy-size` (`layout-stage.css`) | 80px | Round Buy Bonus badge; its right edge lines up with the board frame |
| `--stage-buy-gap` | 10px | Clear space between the marquee / WIN pill and the badge (keep at least 8) |
| `--stage-actor-scale` | .95 | Character size (the puppet is 260 x 340 at 1) |
| `--stage-actor-left` | 40px | Character left edge (arms spread about 25 px further left) |
| `--stage-actor-bottom` | -50px | Character bottom, negative = lower body cut by the stage edge. Needed so the hat and raised arms stay 8 px or more below the stage top in all 6 states |
| `--stage-toast-top` | 190px | Toast top: low in the character stage, clear of the multiplier bar, pot and board |
| `CELL_SIZE` (`main.ts`) | classic 128 x 150, stage 130 x 158 | Cell size per layout, passed to `ReelsView` (`options.cell`) |
| `--special-scale` (`styles.css`) | 1.12 (`--special-size` = 112%) | WILD and SCATTER box as a share of a normal symbol box, centred on the cell, drawn on top. A fixed size, not a scale animation |
| `--marquee-inset` (`styles.css`; stage `layout-stage.css`) | 24px | Empty space at the left and right of the marquee text (about half the stage strip height); equal on both sides |
| `--marquee-fade` (`styles.css`) | 14px | Width of the fade at both ends of the marquee |
| `HudView.MARQUEE_PX_PER_S` (`hudView.ts`) | 80 | Marquee speed in px per second (one pass = box width + text width). Text that fits is shown still and centred |
| Start board (`main.ts` `startFeature`) | 1 SCATTER, 1 WILD | Board shown before the first spin: the scatter on any reel, the wild on a `golden.reels` reel, never in the same reel; the rest normal symbols. Drawn with `setGrid`, no sound or reaction |

## Gold bank look (prototype, `prototype-web/src/framework/views/bankPot.ts` `GOLD_BANK_FX`, `styles.css`): no sim needed
| Setting | Normal / Turbo / Super | What it does |
|---|---|---|
| `GOLD_BANK_FX.coinFlyMs` | 450 / 250 / 0 ms | Coin flies from its card to the pot |
| `GOLD_BANK_FX.potTickMs` | 300 / 150 / 0 ms | The pot counts up to its new value |
| `GOLD_BANK_FX.potFadeMs` | 200 ms (all speeds) | The pot fades in or out |
| `--badge-coin-size` (`styles.css`) | 40px | Size of the badge coin on a golden card |
| `--bank-pot-width` (`styles.css`) | 120px (stage 112px, one row 34 tall, 8 px inside the multiplier row) | Width of the bank pot beside the multiplier bar |
| `GOLD_BANK_FX.bankPulseMs` | 360 / 240 / 0 ms | Pot and lit step yoyo when the bank grows |
| `GOLD_BANK_FX.bankPulseScale` | 1.25 (all) | Peak scale of that yoyo |
| `--bank-pot-value-size` (`styles.css`) | 34px (stage 28px) | Pot value font |
| `--mult-bank-step-size` (`styles.css`) | 32px (stage 28px) | Lit `x2 + 5` step font |

Placeholder CSS look, needs art first. These move to `pace.ts` in the Cocos parity drop.

## Multiplier reveal (prototype, `fx.ts` `MULT_REVEAL_FX`, `styles.css`): no sim needed
| Setting | Normal / Turbo / Super | What it does |
|---|---|---|
| `MULT_REVEAL_FX.multFlyMs` | 450 / 250 / 0 ms | The x7 tag flies from the bar to the prize |
| `MULT_REVEAL_FX.punchMs` | 420 / 220 / 0 ms | The amount swaps, grows and springs back |
| `MULT_REVEAL_FX.punchScale` | 1.45 (all) | Peak scale of the punch |
| `--mult-tag-size` (`styles.css`) | 64px | Flying x7 tag font |

All reveal times 0 (super, or auto spin hurry) = no reveal, today's flow runs.

## Look (Cocos, `client-cocos/assets/game/boardStyle.ts`): Creator recompiles on save
| What | Now |
|---|---|
| Card accent colour per symbol (`ACCENT`) | H1 #c2410c … L4 #65a30d |
| WILD / SCATTER card fill and ring | gold #f2b705, red #be123c; ring #fff3b0 / #b5fff6 |
| WILD / SCATTER ring width and glow (`WILD_GLOW`, `SCATTER_GLOW`) | 3 px ring; glow 14 px, #f5c542 / #29d3c0 at alpha 0.8 |
| Art scale on card | 0.88 normal, 0.72 WILD/SC |

## Glow (Cocos, `client-cocos/assets/framework/ui/glowStyle.ts`): Creator recompiles on save
Matches `prototype-web/src/styles.css`. Glows are CSS-like: blur px, optional spread px, alpha 0 to 1. Loop periods are fixed (they do not speed up in turbo).
| Key | Now | Prototype CSS |
|---|---|---|
| `bandPx` | 2 | drawing quality (smaller = smoother, more vertices) |
| `dimGlowFactor` | 0.28 | `.sym.dim` |
| `win.ring` / `win.glow` | #ffe37a 4 px / #ffe37a alpha 1 blur 26 | `.sym.win` |
| `win.sway` | 1 s, 7 px, 2.5 deg | `winSway` |
| `beam.ring` / `beam.glow` / `beam.radius` | #fff3b0 3 px / #f5c542 alpha 0.75 blur 40 spread 12 / 14 | `.reel.beam` |
| `beam.light` | stops 0 a0, .3 #fff0aa a.55, .5 #ffffe6 a.85, .7 #fff0aa a.55, 1 a0 | `.reel.beam::before` |
| `beam.pulse` | opacity 0.65 to 1, 0.5 s each way | `@keyframes beam` |
| `celebrate.periodSec` / `anticipationPeriodSec` / `tiltDeg` | 0.5 / 0.45 / 4 | `.sym.celebrate`, `.antic-on` |
| `celebrate.rest` / `celebrate.peak` | #b5fff6 3 px + #29d3c0 blur 20 / #ffffff 5 px + #29d3c0 blur 46 | `@keyframes celebrate` |
| `goldCard.rings` / `goldCard.glow` | #fff6c8 3 px then #8a6200 3 px / #f5c542 alpha 0.9 blur 18 | `.sym.gold` |
| `multStep.base` / `multStep.free` | #f5c542 / #29d3c0, alpha 0.8, blur 24 | `.step.on` |
| `winBurst` | 560 x 150, stops .95 / .55 at 45% / 0, 380 ms, scale .25 / 1 / 1.5, opacity .95 / .6 / 0, middle at 55%, `quartOut` | `.win-glow` |
| `spin.rest` / `spin.peak` / `spin.disabled` / `spin.periodSec` | alpha .5 blur 26 / alpha .95 blur 46 / alpha .65 blur 34 (#f5c542) / 2.4 s | `.spin-btn`, `breathe` |
| `buy.glow` / `buy.edge` | #f5c542 alpha .5 blur 18 / #6b4300 4 px | `.buy-btn` |
| `turbo.turbo` / `turbo.super` | #f5c542 alpha .6 blur 14 / #ff4f8b alpha .8 blur 18 | `.turbo-btn` |
| `winnerNotice.glow` | #f5c542 alpha .6 blur 18 | `.winner-notice` |
| `fsTitle.label` / `fsTitle.count` | #b5fff6 + #29d3c0 blur 12 / #ffffff, outline #0b5f57, #29d3c0 blur 24 | `.fs-label`, `.fs-left` |

**Note:** pacing and win tiers live in code today, not in `game.json`. Moving them to config is a candidate framework task.
