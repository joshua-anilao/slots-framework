/** Fast tuning helper: prints key numbers for a game.json. Usage: tsx tools/quick-sim.ts <game.json> [spins] [seed] [buys] [variant] */
import { readFileSync } from 'node:fs';
import { simulate } from '../packages/simulator/src/simulate';
const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const n = Number(process.argv[3] ?? 200000);
const r = simulate(cfg, { spins: n, seed: Number(process.argv[4] ?? 7), buys: Number(process.argv[5] ?? 0), sessions: 0, sessionBalance: 1000, sessionBet: 10, sessionMaxSpins: 500, variant: (process.argv[6] || undefined) as any });
const m = r.main;
const bet = cfg.bet.levels[cfg.bet.defaultIndex];
console.log(JSON.stringify({ variant: r.variant, rtp: +m.rtp.toFixed(4), base: +(m.baseWin / m.cost).toFixed(4), fs: +(m.fsWin / m.cost).toFixed(4), hit: +(m.hits / m.rounds).toFixed(3), fsOneIn: Math.round(m.rounds / m.fsTriggers), avgFsWinX: +(m.fsWin / m.fsTriggers / bet).toFixed(1), sd: +m.sd.toFixed(2), ci90: +m.ci90.toFixed(4), maxX: Math.round(m.maxWinX), caps: m.capHits, buyRtp: r.buy ? +r.buy.rtp.toFixed(4) : null, buyAvgX: r.buy ? +(r.buy.win / r.buy.rounds / bet).toFixed(1) : null, ms: r.durationMs }));
