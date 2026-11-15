# Feature registry

Every switchable feature, toggle and experiment. Status: **Keep** (default, tested), **Trying** (behind a toggle, off by default unless noted), **Drop** (removed or not pursued). Feature numbers come from `SCREENS_AND_FEATURES.md` §5 and never change.

The pipeline adds or updates a row on every `experiment:`, `/iterate … harden` and `/iterate … remove` run.

| # | Feature / option | Status | How to switch | Where | Runs | Notes |
|---|---|---|---|---|---|---|
| 6 | Multiplier variant A (fixed ladder) | Keep | `game.json` `multiplier.variant`; debug panel | math-core | — | Default, decided 2026-11-09 |
| 6 | Multiplier variant B (endless +1) | Trying | debug panel | math-core | — | RTP 96.82% at 10M, buy 51.5x |
| 6 | Multiplier variant C (persists in FS) | Trying | debug panel | math-core | — | RTP 96.34%, pay scale 1.01, buy 48.2x |
| 6 | Multiplier variant D (spots) | Trying | debug panel | math-core | — | RTP 96.81%, most volatile, buy 60x. Cocos has no spot view yet |
| 7 | Golden cards → WILD | Keep | `game.json` `golden.enabled` | math-core | — | Reels 2–4, 8% base, 30% FS |
| 8 | Free spins retrigger | Keep | `game.json` `freeSpins.retrigger` | math-core | — | +2 per extra scatter, max 100 spins |
| 9 | Buy bonus | Keep | `game.json` `buyBonus.enabled` | math-core | — | 50x for A |
| 21 | Spin style: card drop | Keep | debug panel "Spin style" | views | — | Default for Game 001 |
| 21 | Spin style: scrolling reels | Trying | debug panel "Spin style" | views | — | Alternative |
| 21 | Anticipation beam | Keep | `pace.ts` `anticipation` (0 = off) | views | — | Normal and turbo only. Cocos: missing |
| 11 | Turbo / super turbo | Keep | Turbo button | game-logic + views | — | Timings tuned by feel. Cocos: missing |
| 19 | Debug panel | Keep | `?debug` | both clients | — | Session-only overrides |
| — | Haptics on big wins | Drop (for now) | — | — | — | Open question, not planned |

Add new rows at the bottom of their feature number group.
