/**
 * Compare the multiplier variants of a game in one console table. Read-only: writes no files.
 * Usage: npm.cmd run sim:compare [-- <gameDir>] [--spins N] [--seed N] [--buys N] [--variants A,C]
 *   <gameDir>     game folder with a game.json (default games/game-001)
 *   --spins N     rounds per variant (default 1,000,000)
 *   --seed N      RNG seed (default 20261109, same as npm run sim)
 *   --buys N      buy-bonus rounds per variant (default max(10,000, spins / 10))
 *   --variants L  comma list of variants to run, in that order (default A,B,C,D)
 * Table goes to stdout, progress to stderr. Exit 2 on bad arguments.
 * The numbers come from simulate(), so they match the summary.json of npm run sim.
 * At 1M rounds this is a comparison view, not a sign-off: use npm run sim at 10M for that.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameConfig, MultiplierVariant } from '@slots/math-core';
import { simulate } from '../packages/simulator/src/index';
import type { SimReport } from '../packages/simulator/src/index';
import { pct } from '../packages/simulator/src/checks';

export const VARIANTS: readonly MultiplierVariant[] = ['A', 'B', 'C', 'D'];
export const DEFAULTS = {
  gameDir: 'games/game-001',
  spins: 1_000_000,
  seed: 20261109,
  minBuys: 10_000,
  buysPerSpin: 0.1,
};

/** Session stats are skipped, so these are unused; simulate() still requires them. */
const UNUSED_SESSION = { sessions: 0, sessionBalance: 1000, sessionBet: 10, sessionMaxSpins: 500 };
const MISSING = '-';

export interface CompareOptions {
  spins: number;
  seed: number;
  buys: number;
  variants: readonly MultiplierVariant[];
  onVariantDone?: (row: CompareRow, ms: number) => void;
}
export interface CompareRow {
  variant: MultiplierVariant;
  rtp: number;
  rtpCi90: number;
  hitRate: number;
  freeSpinsOneIn: number | null;
  volatilityIndex: number;
  buyRtp: number | null;
}
export interface CliArgs { gameDir: string; spins: number; seed: number; buys: number; variants: MultiplierVariant[] }

const USAGE = 'Usage: npm.cmd run sim:compare [-- <gameDir>] [--spins N] [--seed N] [--buys N] [--variants A,C]';

function fail(message: string): never {
  throw new Error(`${message}\n${USAGE}`);
}

function parseNumber(flag: string, raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '' || !Number.isFinite(Number(raw))) fail(`${flag} needs a number, got "${raw ?? ''}"`);
  return Number(raw);
}

function parseVariants(raw: string | undefined): MultiplierVariant[] {
  if (!raw) fail('--variants needs a list like A,C');
  const out: MultiplierVariant[] = [];
  for (const part of raw.split(',')) {
    const letter = part.trim().toUpperCase() as MultiplierVariant;
    if (!VARIANTS.includes(letter)) fail(`Unknown variant "${part}". Use ${VARIANTS.join(', ')}`);
    if (!out.includes(letter)) out.push(letter);
  }
  return out;
}

export function parseArgs(argv: string[]): CliArgs {
  let gameDir = DEFAULTS.gameDir;
  let spins = DEFAULTS.spins;
  let seed = DEFAULTS.seed;
  let buys: number | undefined;
  let variants: MultiplierVariant[] = [...VARIANTS];
  let gameDirSeen = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--spins') spins = parseNumber(arg, argv[++i]);
    else if (arg === '--seed') seed = parseNumber(arg, argv[++i]);
    else if (arg === '--buys') buys = parseNumber(arg, argv[++i]);
    else if (arg === '--variants') variants = parseVariants(argv[++i]);
    else if (arg.startsWith('--')) fail(`Unknown flag ${arg}`);
    else if (gameDirSeen) fail(`Unexpected extra argument "${arg}"`);
    else { gameDir = arg; gameDirSeen = true; }
  }

  if (!Number.isInteger(spins) || spins <= 0) fail(`--spins must be a whole number above 0, got ${spins}`);
  if (!Number.isInteger(seed)) fail(`--seed must be a whole number, got ${seed}`);
  if (buys !== undefined && (!Number.isInteger(buys) || buys < 0)) fail(`--buys must be a whole number, 0 or more, got ${buys}`);
  if (!existsSync(join(gameDir, 'game.json'))) fail(`No game.json found in "${gameDir}"`);

  return { gameDir, spins, seed, buys: buys ?? defaultBuys(spins), variants };
}

/** Same rule as the sim CLI: max(10,000, spins / 10). */
export function defaultBuys(spins: number): number {
  return Math.max(DEFAULTS.minBuys, Math.floor(spins * DEFAULTS.buysPerSpin));
}

function toRow(variant: MultiplierVariant, report: SimReport): CompareRow {
  const m = report.main;
  return {
    variant,
    rtp: m.rtp,
    rtpCi90: m.ci90,
    hitRate: m.hits / m.rounds,
    freeSpinsOneIn: m.fsTriggers ? m.rounds / m.fsTriggers : null,
    volatilityIndex: m.sd,
    buyRtp: report.buy?.rtp ?? null,
  };
}

/** Runs the sim once per variant. simulate() applies the variant on its own copy, so config is not changed. */
export function compareVariants(config: GameConfig, opts: CompareOptions): CompareRow[] {
  return opts.variants.map(variant => {
    const t0 = Date.now();
    const report = simulate(config, { variant, spins: opts.spins, seed: opts.seed, buys: opts.buys, ...UNUSED_SESSION });
    const row = toRow(variant, report);
    opts.onVariantDone?.(row, Date.now() - t0);
    return row;
  });
}

function finiteOrNull(v: number | null): number | null {
  return v !== null && Number.isFinite(v) ? v : null;
}

function cells(row: CompareRow): string[] {
  const freeSpins = finiteOrNull(row.freeSpinsOneIn);
  const buyRtp = finiteOrNull(row.buyRtp);
  const volatility = finiteOrNull(row.volatilityIndex);
  return [
    row.variant,
    Number.isFinite(row.rtp) ? pct(row.rtp) : MISSING,
    Number.isFinite(row.hitRate) ? pct(row.hitRate) : MISSING,
    freeSpins === null ? MISSING : `1 in ${Math.round(freeSpins)}`,
    volatility === null ? MISSING : volatility.toFixed(2),
    buyRtp === null ? MISSING : pct(buyRtp),
  ];
}

export function formatTable(rows: CompareRow[], meta: { gameName: string; spins: number; seed: number; buys: number }): string {
  const header = ['Variant', 'RTP', 'Hit rate', 'Free spins', 'Volatility', 'Buy RTP'];
  const body = rows.map(cells);
  const widths = header.map((h, c) => Math.max(h.length, ...body.map(r => r[c].length)));
  const line = (r: string[]) => r.map((cell, c) => cell.padEnd(widths[c])).join(' | ').trimEnd();
  const margin = Math.max(0, ...rows.map(r => (Number.isFinite(r.rtpCi90) ? r.rtpCi90 : 0)));

  return [
    `${meta.gameName}: ${meta.spins.toLocaleString('en-US')} rounds per variant, ${meta.buys.toLocaleString('en-US')} buys, seed ${meta.seed}`,
    line(header),
    ...body.map(line),
    `RTP margin at this size: ± ${pct(margin)} (90%). Sign-off still needs npm.cmd run sim at 10M rounds.`,
  ].join('\n');
}

function main(): void {
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(2);
  }
  const config = JSON.parse(readFileSync(join(args.gameDir, 'game.json'), 'utf8')) as GameConfig;
  const rows = compareVariants(config, {
    spins: args.spins,
    seed: args.seed,
    buys: args.buys,
    variants: args.variants,
    onVariantDone: (row, ms) => console.error(`  variant ${row.variant} done in ${(ms / 1000).toFixed(1)}s`),
  });
  console.log(formatTable(rows, { gameName: config.name, spins: args.spins, seed: args.seed, buys: args.buys }));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
