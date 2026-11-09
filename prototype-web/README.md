# prototype-web (Track 1)

The fast HTML prototype. Plain TypeScript + DOM views on top of the shared `math-core` and `game-logic`, run with Vite. Throwaway visuals, real math.

## Run it

```
npm run proto
```

Open the printed link. On your phone, use the "Network" link (phone and PC on the same Wi-Fi).

- `?debug=1` opens the debug panel (or tap the version label 5 times).
- `?seed=42` replays the same spins every time.
- Space or tapping the reels: spin / stop / skip.

## Layout

| Folder | What |
|---|---|
| `src/main.ts` | Boot: builds the game (`createLocalGame`) and the views |
| `src/views/` | Reels, HUD, overlays, and `HtmlRoundPresenter` (plays a Spin Result) |
| `src/windows/` | Popups (Change Bet, more in 2b/2c) |
| `src/theme/` | `Theme` interface + placeholder theme (frame names from the art guide) |
| `src/debug/` | Debug panel (session-only overrides) |
| `src/core/pace.ts` | Pacing table from the design guide (normal / turbo / super turbo) |
| `src/strings.ts` | All player-facing text |
