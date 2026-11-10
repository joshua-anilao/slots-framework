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
| `src/main.ts` | Boot: builds the game (`createLocalGame`) and the views (composition root) |
| `src/framework/` | Reusable pieces, see `src/framework/README.md`. Never imports from `game/` |
| `src/game/` | Game 001 only: placeholder theme (everything else was promoted to the framework) (see `src/game/README.md`) |
| `src/styles.css` | All styles (framework and game rules still share one file) |
