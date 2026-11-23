# Glossary

One line per term. Add a row when a brief uses a new word.

## Slot math
| Term | Meaning |
|---|---|
| RTP | Return to player: average share of bets paid back over millions of rounds. Target 96.5% ± 0.5% at 10M rounds |
| Hit rate / hit frequency | Share of rounds that pay anything. Target 30–45% |
| Volatility | How swingy wins are. Medium-high for Game 001 (index ~7) |
| Ways (1,024 ways) | A win is matching symbols on adjacent reels from the left, any row; 4×4×4×4×4 = 1,024 combinations |
| Reel strip | The ordered list of symbols a reel stops on; weights in `strip-weights.json` |
| Paytable | Pay per symbol for 3, 4, 5 of a kind, as multiples of the bet per way |
| Cascade | Winning cards vanish, cards above fall, new ones drop in, evaluate again |
| Multiplier ladder | Win multiplier that steps up each cascade. Variant A: x1 x2 x3 x5, free spins x2 x4 x6 x10 |
| Variant (A–D) | Alternative multiplier rules switchable in debug; each has its own pay scale and buy price |
| Golden card | A card on reels 2–4 that turns into WILD after it wins |
| Gold bank | Feature 23. When a golden card with a badge wins, its badge value goes into the bank; from the next cascade step the multiplier is the ladder multiplier plus the bank. Resets every spin, or keeps growing through free spins (`carryInFree`). Off by default |
| Badge | A value (x2, x5, ...) some golden cards carry for the gold bank. Rolled when the golden card lands; kept while it falls; banked when the card wins |
| Scatter (SC) | Pays free spins when 3+ land anywhere |
| Free spins (FS) | Bonus round; retrigger adds spins |
| Buy bonus | Pay 50x bet to start free spins at once; has its own RTP |
| Max win cap | Most a round can pay: 2,000x bet |
| PAR sheet | CSV of the math breakdown the simulator writes |
| RTP band check | Test that fails if sim RTP leaves the target band |
| Seed | Number that makes the RNG replay the same rounds |

## Code
| Term | Meaning |
|---|---|
| math-core | The engine package; the only code that decides outcomes |
| game-logic | Shared models, controllers, state machines and services |
| RoundResult | Everything one round did (grids, wins, cascades, features), produced by math-core and played back by views |
| Override layer | Session-only debug changes on top of `game.json` |
| sync:cocos | Script that copies packages into `client-cocos/assets/shared` |
| Framework / game | Framework = reusable by any game; game = only this game. Framework never imports game |
| Prefab | Reusable view part in Cocos (or its HTML equivalent) |
| Recipe | `recipe.json`: which feature modules a game uses |
| Feature number | Permanent number of a feature (1–23 so far) used on layout sketches |
| Pace / timing set | Animation timings per speed: normal, turbo, super turbo |
| Win tier | Big (10x), Super (25x), Ultra (50x) celebration thresholds |
| Parity | Whether the Cocos client matches the HTML prototype (`docs/COCOS_PARITY.md`) |
| Drop | One shippable batch of Cocos work (Drop A, B, C) |

## Process
| Term | Meaning |
|---|---|
| Run | One request going through the pipeline; has its own folder in `.pipeline/runs/<run-id>/` |
| Stage | One agent's turn in a run (spec, implementation, tests, review) |
| Hand-off | The file a stage writes for the next one, in `handoff-format.md` |
| Lane | Which path a run takes: full, play-first, experiment, quick |
| Gate | A point where Claude stops and asks Josh; never guessed past |
| Conductor | The main Claude session that launches each stage |
| Play check | Short list of what Josh should look at or listen to |
| QA pending | Play-first run whose tests and review are not done yet |
| Trying / Keep / Drop | Status of a feature or experiment in `docs/FEATURES.md` |
| Busy engine | Cocos Creator is holding something the agent needs (a CLI build of the live project); ask Josh to free it |
