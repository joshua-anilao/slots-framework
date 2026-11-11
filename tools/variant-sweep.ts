/**
 * Tuning helper: tries multiplier settings for one variant and prints RTP / hit / volatility for each.
 * Usage: tsx tools/variant-sweep.ts <game.json> <variant> '<json patch for multiplier>' ['<another patch>' ...]
 * Example: tsx tools/variant-sweep.ts games/game-001/game.json D '{"D":{"cap":8}}' '{"D":{"cap":16}}'
 */
import { readFileSync } from 'node:fs';
import { applyOverrides } from '../packages/math-core/src/overrides';
import { simulate } from '../packages/simulator/src/simulate';

const [file, variant, ...patches] = process.argv.slice(2);
const base = JSON.parse(readFileSync(file, 'utf8'));
const bet = base.bet.levels[base.bet.defaultIndex];
for (const p of patches) {
  const { config } = applyOverrides(base, { multiplier: { variant, ...JSON.parse(p) } } as never);
  const r = simulate(config, { spins: 1_000_000, seed: 11, buys: 30_000, sessions: 0, sessionBalance: 1000, sessionBet: 10, sessionMaxSpins: 500 });
  const m = r.main;
  console.log(JSON.stringify({
    patch: p, rtp: +m.rtp.toFixed(4), ci90: +m.ci90.toFixed(4), base: +(m.baseWin / m.cost).toFixed(4), fs: +(m.fsWin / m.cost).toFixed(4),
    hit: +(m.hits / m.rounds).toFixed(3), sd: +m.sd.toFixed(1), maxX: Math.round(m.maxWinX), caps: m.capHits,
    buyRtp: r.buy ? +r.buy.rtp.toFixed(4) : null, avgFsX: +(m.fsWin / m.fsTriggers / bet).toFixed(1),
  }));
}
