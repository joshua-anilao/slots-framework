# Gold Frame Bank (feature 23) - approved plan, 2026-11-22

Source doc: https://claude.ai/artifact/84zkU2gJDBYGfMwrDESpVL. Josh approved 2026-11-22. This run = drop 1 (engine, simulator, tests). Drop 2 (HTML prototype visuals) is a later run. Cocos parity later.

Placement: math-core (framework), feature 23, status Trying, `game.json` switch off by default for game-001.

## Rules
1. When a golden card lands (base or dropped in), roll whether it carries a badge (`badgeChanceBase` / `badgeChanceFree`), value picked by weight from `valuesBase` / `valuesFree`.
2. When a badged golden card is part of a win, it turns wild as usual and its badge value is added to the bank.
3. Bank adds to the ladder from the NEXT cascade step: step multiplier = strategy multiplier + bank. No badge = identical to today.
4. Bank resets at the start of every spin. If `carryInFree` is true, the bank keeps growing across the whole free spins feature (reset at feature start and on base spins).
5. maxWinX cap still clamps.
Example (ladder x1 x2 x3 x5): step 1 pays x1, a x5 badge banks; step 2 pays x2+5 = x7, a x3 banks; step 3 pays x3+8 = x11.

## Config (`game.json`, starting values; tune with sim)
```json
"goldBank": {
  "enabled": false,
  "badgeChanceBase": 0.15,
  "badgeChanceFree": 0.30,
  "valuesBase": [{ "v": 2, "w": 50 }, { "v": 3, "w": 30 }, { "v": 5, "w": 15 }, { "v": 10, "w": 5 }],
  "valuesFree": [{ "v": 2, "w": 40 }, { "v": 5, "w": 35 }, { "v": 10, "w": 20 }, { "v": 25, "w": 5 }],
  "carryInFree": false
}
```
Pay scale: add a way to scale pays when the bank is on (e.g. `goldBank.payScale`) so RTP stays 96.5%. Buy bonus gets its own price when the bank is on.

## Engine changes
- config.ts: `GoldBankConfig`, optional `goldBank` on GameConfig.
- validateConfig.ts: chances 0..1, weights > 0, values >= 2.
- result.ts: `Cell.b?: number` badge value; `CascadeStep.bank: number`; `CascadeStep.banked: { pos: Pos; value: number }[]`.
- reelState.ts: roll badge when a cell lands golden (snapshot copies `b`).
- new goldBank.ts: `GoldBank` class (startFeature, startSpin(isFree), add, value) holding the carry rule.
- spinRunner.ts: step multiplier = strategy + bank; resolveWins adds badges of golden->wild cells and reports `banked`.
- slotEngine.ts: one GoldBank per round next to the multiplier strategy.
- tests (new goldBank.test.ts): disabled = identical results with same seed; worked example; reset and carry rules; cap holds.
- simulator: bank stats (avg bank per spin, share of RTP from steps with bank > 0, max bank).
- docs/FEATURES.md row 23 (Trying), docs/SCREENS_AND_FEATURES.md section 5 row 23 `goldBank`.
- Debug: session-only on/off + carry toggle + "force badge" in debugController (game-logic) if cheap; UI rows come in drop 2.

## Done criteria
- Tests + `npm run check` pass.
- 10M sim with bank on, reset mode: RTP 96.5% +/- 0.5% (via pay scale), hit rate and FS frequency unchanged vs variant A (38.5%, 1 in 140), cap hits < 1 in 1M, buy bonus RTP within +/- 2%. Also a 10M sim with carryInFree=true; report both side by side with variant A today (RTP 96.50%, vol index 7.14, max ~1,000x).
- Do not flip `enabled` to true in game.json; put tuned values in game.json with enabled false, and report.
