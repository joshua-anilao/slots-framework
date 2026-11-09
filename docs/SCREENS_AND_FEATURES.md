# Screens and Features: Standard Game v1

The **standard game** is our base: a 5x4, 1,024-ways cascade slot with the feature set and screen structure common to the top PH "card cascade" slots (Super Ace-style mechanics and layout). Every later game is a recipe built from these modules.

**Originality rule:** we copy the *genre-standard mechanics and screen structure* only. Name, logo, theme, symbols and art are our own. Working title: **Game 001** (name TBD).

## 1. Screen flow

```
Boot ─► Loading ─(Continue)─► Tutorial? ─► Game
                                             ├─ Change Bet window
                                             ├─ Auto Spin window
                                             ├─ Buy Bonus window
                                             ├─ Settings ─ Game Rules / Auto Spin settings / Sound
                                             ├─ Bet History
                                             └─ Free Spins (intro ► spins ► outro)
```
- Tutorial shows on first play; "Don't show next time" checkbox on the loading screen skips it.

## 2. Loading screen

| Element | Notes |
|---|---|
| Game logo / banner | From theme |
| Volatility indicator | e.g. 1–5 icons, value from `game.json` |
| Tutorial carousel | Pages with ◀ ▶ arrows + swipe + page dots; page content from config (image + text) |
| Loading bar | Real progress of the boot asset group |
| Continue button | Appears/enables when boot group is loaded |
| "Don't show next time" | Skips tutorial carousel next visit (stored on device) |
| Version + copyright | Small footer |

## 3. Game screen (portrait, top to bottom)

| Area | Elements |
|---|---|
| **Top bar** | **Winner ticker**: "JOS\*\*\*\* just won ₱15,000!" sliding notification. **Scrolling marquee** text (promos/messages from config) |
| **Header** | Game logo; **Buy Bonus** button (top-right) |
| **Multiplier bar** | Ladder steps (base x1 x2 x3 x5; free spins x2 x4 x6 x10), current step lit; free spins counter during feature |
| **Reels** | 5 columns × 4 rows; golden symbols on reels 2–4; win highlights, cascades |
| **Win row** | WIN ₱amount |
| **Control bar** | Settings (left), **Bet** button showing current bet (opens Change Bet window), **Spin** (center, big), **Auto spin**, **Turbo** (cycles normal → turbo → super turbo, toast "Super Turbo Spin Enabled/Disabled") |
| **Footer** | **Balance** ₱; **Wifi/connection strength** icon; version; round/transaction id |

## 4. Popups and windows

### Change Bet window
- Bet value list from config (e.g. ₱1, 2, 3, 5, 10, 20, 50, 100…), − / + and direct pick. Shows current bet. Confirm closes.

### Auto Spin window
- Spin count options (10, 20, 50, 100, ∞?) and stop conditions: stop on feature, stop if single win ≥, stop if balance drops by ≥. Start button.

### Buy Bonus window
- Feature icon, Bet − / +, Quantity − / +, Price (= bet × buy multiplier from config, e.g. 50x), Total, **Buy & Play**. Disabled if balance too low. Confirmation step.

### Settings
- Tabs/buttons: **Game Rules** (paytable generated from config, feature explanations, RTP, max win), **Auto Spin settings** (defaults), **Sound** (music/SFX), Turbo default, (Haptics?).

### Bet History
- Filters: last 15 min / 30 min / 1 hour, date, round number search.
- Each row: Net win, Bet / Win, Transaction (round) id, Time (with timezone). Tap row → round detail: replay of grids and wins (from stored Spin Result).
- Source: `IHistoryService` (session memory now, server later).

### Free Spins
- Intro: "10 FREE SPINS" + Start. During: counter, free-spin ladder, retrigger "+N". Outro: total win + Collect.

### Big / Super / Ultra Win overlay
- Coin explosion, title escalation, count-up, tap to skip.

## 4b. Reel spinning (feature 21)

How the reels physically spin and stop. The outcome is already decided by the math engine; this only animates it.

| Part | Behaviour | Config |
|---|---|---|
| Start | All 5 reels kick up slightly then spin down, left to right with a small delay | kick height, start stagger |
| Spinning | Symbols scroll fast with motion blur (blurred symbol frames from atlas) | spin speed |
| Stop order | Reels stop left → right with a short gap; each lands on the result symbols | stop gap per speed mode |
| Landing | Small bounce on stop + "thunk" sound | bounce strength |
| Anticipation | If 2 scatters have landed, remaining reels spin longer and glow (normal speed only) | extra time |
| Tap to stop | Tapping Spin while spinning slams all reels to stop at once | on/off |
| Turbo / super turbo | Shorter spin and stop gaps (design guide pacing table) | timing sets |
| Cascade refill | After wins pop, symbols above drop down and new ones fall in from the top (not a full spin) | drop speed, stagger |
| Free spins | Same spin, free spins skin and ladder | — |

Implementation: one `ReelView` per column with a symbol strip that recycles symbol objects (pooling), driven by a `ReelSpinController` that receives the target grid from the Spin Result. Works with sprite or Spine symbols.

## 5. Feature list → modules

| # | Feature | Module id | Math part? | Notes |
|---|---|---|---|---|
| 1 | Bet selection | `bet` | — | Bet levels in config |
| 2 | Balance display | `wallet` | — | `IWalletService` (demo balance now) |
| 3 | Spin / start | `spinFlow` | yes | State machine: idle → spinning → resolving steps → win → idle |
| 4 | Ways evaluation 1,024 | `waysPays` | yes | |
| 5 | Cascades | `cascade` | yes | |
| 6 | **Cascading multiplier** | `multiplierLadder` | yes | See section 6, variants to try |
| 7 | Golden symbols → wild | `goldenWild` | yes | Chance per reel in config |
| 8 | Scatter + free spins | `scatterFreeSpins` | yes | Count, retrigger, FS ladder |
| 9 | Buy bonus | `buyBonus` | yes | Price multiplier; own RTP in sim |
| 10 | Auto spin | `autoSpin` | — | Count + stop conditions |
| 11 | Turbo / super turbo | `speed` | — | Timing sets from design guide |
| 12 | Big / Super / Ultra win | `bigWin` | — | Thresholds in config |
| 13 | Winner ticker | `winFeed` | — | `IWinFeedService` |
| 14 | Scrolling marquee | `marquee` | — | Messages in config/server |
| 15 | Connection strength | `connection` | — | Latency-based (see notes) |
| 16 | Bet / transaction history | `history` | — | `IHistoryService` |
| 17 | Loading + tutorial | `loading`, `tutorial` | — | |
| 18 | Settings + game rules | `settings`, `rules` | — | Rules generated from config |
| 19 | Debug panel | `debug` | — | Session-only overrides |
| 20 | Sound | `audio` | — | |
| 21 | **Reel spinning** (the visual spin) | `reelSpin` | — | Reels spin, stop in order, land on the Spin Result grid. See section 4b |

## 6. Cascading multiplier: variants to try in the prototype

You haven't picked a favourite yet, so the prototype will let you switch between these in the debug panel and the sim will report each one's RTP and volatility:

| Variant | How it works | Feel |
|---|---|---|
| **A. Fixed ladder** (default) | x1 → x2 → x3 → x5, caps at x5; free spins x2 → x4 → x6 → x10 | Familiar, readable, medium volatility |
| **B. Endless +1** | x1, x2, x3, x4… no cap during a spin | More "chase", higher volatility |
| **C. Ladder that persists in free spins** | Free-spin multiplier doesn't reset between free spins | Big free-spins swings, very high volatility |
| **D. Multiplier spots** | A cell that wins twice gets x2, then x4, x8… for the rest of the spin | Visual, modern, high volatility |

## 7. Implementation notes and recommendations

- **Wifi strength:** browsers can't read real Wi-Fi signal. We show **connection quality** from measured round-trip time to the server (and `navigator.connection` where available): 3 bars < 150 ms, 2 bars < 400 ms, 1 bar otherwise, red when offline. In the prototype it's simulated with a debug slider.
- **Winner ticker:** in the prototype it uses a simulated feed, labeled as demo in the debug build. In production it must come from **real** wins via the server; fabricated winner announcements to real players would be misleading.
- **Transaction id:** every round gets a unique id shown in the footer and in history (needed for player support).
- **Interrupted rounds:** if the page closes mid-free-spins, the round resumes on next load (server-side later; local session now).
- **Insufficient balance:** spin disabled, toast + bet button pulse.

## 8. Layout sketch workflow (future games)

1. Josh draws the screen layout (paper, Figma, anything) and writes a **feature number** from the table in section 5 inside each box (e.g. `3` = Spin, `6` = Multiplier bar, `9` = Buy Bonus).
2. Boxes with no number, or with a note, are **new features**: describe them in one line and they get the next free number.
3. Claude turns the sketch into `games/<id>/layout.json` (each number → module id, position, size, anchor) and `recipe.json` (the feature list).
4. Existing modules are reused as-is; only new numbers need code.

Rules: feature numbers never change or get reused once assigned, so old sketches stay valid. Each module may expose sub-parts (e.g. `3a` Spin button, `3b` spin count label) when a sketch needs to place them separately.
