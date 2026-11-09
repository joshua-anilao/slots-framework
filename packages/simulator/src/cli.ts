/**
 * Simulator CLI.
 *   npm run sim -- games/game-001
 *   npm run sim -- games/game-001 --spins 10000000 --variant B --seed 42 --buys 200000 --sessions 5000
 * Writes games/<id>/reports/<variant>/report.html, par-sheet.csv and summary.json.
 * Exit code 1 if a target is off (useful for automated checks).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { GameConfig, MultiplierVariant } from '@slots/math-core';
import { simulate } from './simulate';
import { buildHtmlReport } from './htmlReport';
import { buildParSheet } from './parSheet';
import { checkTargets, pct } from './checks';

const args = process.argv.slice(2);
const gameDir = args.find(a => !a.startsWith('--'));
if (!gameDir) {
  console.error('Usage: npm run sim -- games/<id> [--spins N] [--seed N] [--variant A|B|C|D] [--buys N] [--sessions N] [--out dir]');
  process.exit(2);
}
const flag = (name: string, def: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const variantIdx = args.indexOf('--variant');
const variant = variantIdx >= 0 ? (args[variantIdx + 1] as MultiplierVariant) : undefined;
const outIdx = args.indexOf('--out');

const config = JSON.parse(readFileSync(join(gameDir, 'game.json'), 'utf8')) as GameConfig;
const spins = flag('spins', 1_000_000);
console.log(`Simulating ${config.name}: ${spins.toLocaleString()} rounds${variant ? `, variant ${variant}` : ''}...`);

const report = simulate(config, {
  spins,
  seed: flag('seed', 20261109),
  variant,
  buys: flag('buys', Math.max(10_000, Math.floor(spins / 10))),
  sessions: flag('sessions', 2_000),
  sessionBalance: flag('balance', 1000),
  sessionBet: flag('bet', 10),
  sessionMaxSpins: flag('max-spins', 500),
  onProgress: (done, total) => process.stdout.write(`\r  ${Math.round((done / total) * 100)}%`),
});
process.stdout.write('\n');

const outDir = resolve(outIdx >= 0 ? args[outIdx + 1] : join(gameDir, 'reports', report.variant));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'report.html'), buildHtmlReport(report));
writeFileSync(join(outDir, 'par-sheet.csv'), buildParSheet(report));
const checks = checkTargets(report);
const m = report.main;
writeFileSync(join(outDir, 'summary.json'), JSON.stringify({
  game: report.game, variant: report.variant, seed: report.seed, rounds: report.spins, createdAt: report.createdAt,
  rtp: m.rtp, rtpBase: m.baseWin / m.cost, rtpFreeSpins: m.fsWin / m.cost, rtpCi90: m.ci90,
  hitFrequency: m.hits / m.rounds, freeSpinsOneIn: m.fsTriggers ? m.rounds / m.fsTriggers : null,
  volatilityIndex: m.sd, maxWinX: m.maxWinX, capHits: m.capHits,
  buyBonusRtp: report.buy?.rtp ?? null, session: report.session, checks,
}, null, 2) + '\n');

console.log(`RTP ${pct(m.rtp)} (± ${pct(m.ci90)})  base ${pct(m.baseWin / m.cost)}  free spins ${pct(m.fsWin / m.cost)}`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'OFF '}  ${c.name}: ${c.value} (target ${c.target})`);
console.log(`Report: ${join(outDir, 'report.html')}`);
process.exit(checks.every(c => c.pass) ? 0 : 1);
