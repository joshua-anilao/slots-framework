# Design Guide

The general **feeling** of our games. Per-game differences go in `games/<id>/guides/design.md`.

## 1. Feeling we want

- **Lightning fast.** A spin should feel instant and snappy; no dead time. The player is never waiting for animations they don't care about.
- **Exciting wins.** Wins escalate visually with size; cascades build tension as the multiplier climbs.
- **Clear.** At any moment the player knows: balance, bet, last win, current multiplier, free spins left.
- **Trustworthy.** Numbers are always correct and readable; nothing looks rigged.

## 2. Pacing (all values in config)

Normal speed is matched to the reference gameplay video (Josh, 2026-11-09), measured frame by frame. Source of truth in code: `prototype-web/src/core/pace.ts`.

| Moment | Normal | Turbo | Super turbo |
|---|---|---|---|
| Spin: old cards fall out | 0.2 s | 0.12 s | 0.08 s |
| Spin: new cards drop in (reel by reel, bottom card first) | ~0.8 s | ~0.4 s | ~0.2 s |
| Anticipation, per remaining reel (2+ scatters) | +0.6 s, one reel at a time under a spotlight | off | off |
| Win highlight (winning cards glow, rest dim, amount shown) | 1.0 s | 0.55 s | 0.3 s |
| Winning cards burst | 0.4 s | 0.25 s | 0.15 s |
| Cascade drop | 0.3 s | 0.2 s | 0.12 s |
| Gold card back → WILD reveal (after the drop) | 0.3 s | 0.18 s | 0.1 s |
| Whole cascade step | ~2.2–2.5 s | ~1.2 s | ~0.7 s |
| Scatter celebration before free spins | 2.0 s | 1.2 s | 0.7 s |
| Free spins intro banner | 2.2 s + ladder sweep 1.4 s | 1.5 s | 1.0 s |
| Big win / free spins total count-up | 4 s (skippable) | 2.5 s | 1.5 s |

- **Tap to stop / skip:** tapping during a spin slams reels; tapping during a count-up jumps to the final amount.
- **Anticipation:** with 2 scatters landed, remaining reels slow and glow (normal speed only). Never changes the outcome.

## 3. Win celebration tiers (thresholds in config, × bet)

| Tier | Default threshold | Feel |
|---|---|---|
| Normal win | < 10x | Highlight + count-up in WIN box |
| **Big Win** | ≥ 10x | Title + coin burst + music sting |
| **Super Win** | ≥ 25x | Bigger title, stronger coin shower, screen shake |
| **Ultra Win** | ≥ 50x | Full-screen coin explosion, camera punch, longest music |

Order: Big → Super → Ultra (each escalates into the next during the count-up).

## 4. Feedback ("juice") rules

- Every button press has a visual + sound response within 50 ms.
- Multiplier bar: active step glows; on step-up, pulse + sound pitch rises with each step.
- Golden → Wild transform: flash + flip, distinct sound.
- Scatter land: each scatter has a rising "ding" (1st, 2nd, 3rd).
- Haptics (vibrate) on big wins where supported, off by default in settings? → **[OPEN]**

## 5. Sound

- BGM base game, BGM free spins, spin, reel stop, win small/medium, cascade pop, multiplier up, scatter land 1–3, golden-to-wild, big/super/ultra win, button click, popup open/close.
- Music and SFX toggles separately in Settings. Remember choice per device.

## 6. UX rules

- Spin button bottom-center, largest element. Bet and auto next to it; settings bottom-left.
- Balance and Win always visible. Insufficient balance → bet button shakes + toast, no spin.
- Autospin always shows remaining count on the spin button and stops on: feature trigger, single win ≥ X, balance below Y (player-set).
- Popups: one at a time, dim background, close with X or tap outside (except confirmations).
- Text is in a strings table from day one (English now, Tagalog later).

## 7. Responsible-play basics (recommended)

- Autospin requires a loss limit or count.
- Game Rules screen shows RTP and max win.
- Winner ticker in demos is clearly simulated; in production it shows real data only.
