# @slots/simulator

Runs math-core millions of times and writes a report.

```bash
npm run sim -- games/game-001                         # 1M rounds, variant from game.json
npm run sim -- games/game-001 --spins 10000000        # final check
npm run sim -- games/game-001 --variant B             # try another multiplier variant
npm run sim -- games/game-001 --seed 7 --buys 200000 --sessions 5000
npm run sim -- games/game-001 --gold-bank reset       # gold bank on for this run only (off | reset | carry)
```

With the gold bank on, the report goes to `reports/<variant>-bank-reset` or `-bank-carry` and gets a "Gold bank" section; `summary.json` gets `goldBank` and `bank`. `game.json` is never written.

Writes to `games/<id>/reports/<variant>/`:

| File | For |
|---|---|
| `report.html` | Open in a browser: RTP, hit rate, free spins, volatility, distribution, buy bonus, player sessions, target check |
| `par-sheet.csv` | Opens in Excel: full numbers, paytable, symbol contributions, reel strips |
| `summary.json` | Machine-readable summary for automated checks |

Exit code is 1 when a target in `game.json` is off, so it can gate a build.

**About precision:** RTP from a simulation has noise. The report shows a 90% confidence range. At 10M rounds this game is about ±0.4%; pinning ±0.1% would need 100M+ rounds.
