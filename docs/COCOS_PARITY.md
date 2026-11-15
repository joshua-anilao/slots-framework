# Cocos client vs HTML prototype: feature parity

Checked 2026-11-15 against `prototype-web` (Phase 3b) and `docs/SCREENS_AND_FEATURES.md`. Status: DONE (matches the prototype), PART (some of it), NONE (missing).
The rule from now on: a Cocos drop is only "done" when its rows here are DONE and Josh has seen them in the browser.

## Game screen

| # | Feature | Prototype | Cocos now | Gap |
|---|---|---|---|---|
| 3,21 | Spin, card drop, skip (slam) | yes | PART | Drop and skip work. No anticipation beam, no per-scatter ding, no turbo timings. |
| 4,5 | Ways wins, cascades | yes | PART | Works. Winning cards only dim the others; no glow, no sparkle burst, no win amount popping over the board and flying to WIN. |
| 6 | Multiplier | bar + steps + burst | PART | Number shown as text only. No multiplier bar with lit steps (A/B/C), no spots on the board (D). |
| 7 | Golden to WILD | card flips to back, then WILD | PART | Cell just changes to WILD at the end of the drop. No flip, no sway on winning wild. |
| 8 | Scatter and free spins | anticipation, dim and pulse, banner, ladder sweep, FS left counter, retrigger, outro count-up | NONE | Only plays the free spins one after another with a text line. No intro, outro, counter in the title, retrigger. |
| 12 | Big / Super / Ultra win | overlay, coins, count-up | NONE | |
| 9 | Buy Bonus | window, price, quantity | NONE | Debug panel can buy one. |
| 10 | Auto spin | window, counts, stop conditions, STOP | NONE | |
| 11 | Turbo / super turbo | button cycles, toast, timings | NONE | |
| 1 | Bet window | list, -/+ loop around | PART | -/+ loop around only; no window. |
| 13 | Winner ticker | yes | NONE | |
| 14 | Marquee | yes | NONE | |
| 15 | Connection bars | yes | NONE | |
| 2 | Balance, footer (round id, version) | yes | PART | Balance only. |
| 20 | Sound | all hooks | PART | Spin, reel stop, win, pop only. Missing scatter, multiplier, to-wild, fly, big win, coin, FS intro, retrigger, anticipation hooks. |

## Screens and windows

| Feature | Prototype | Cocos now |
|---|---|---|
| Loading screen with tutorial, Continue | yes | NONE (text "Loading...") |
| Menu, Settings, Game Rules, Auto Spin settings, Sound | yes | NONE |
| Bet History and round detail | yes | NONE |
| Interrupted round resume | yes | shared logic only, no view |
| Debug panel | yes | DONE |

## Build order (each drop: Coder, Josh tests in the browser, commit)

1. **Drop A, the feel of a round:** wild flip and sway, scatter pulse and anticipation, win glow/burst/win popup flying to WIN, multiplier bar, free spins intro, counter, retrigger and outro, big win overlay, all sound hooks.
2. **Drop B, controls:** auto spin (window, loop, stop conditions, STOP), turbo and super turbo, bet window, buy bonus window.
3. **Drop C, menus and chrome:** loading screen with tutorial, menu/settings/rules/history, winner ticker, marquee, connection bars, footer.
