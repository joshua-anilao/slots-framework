import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { GameConfig } from '@slots/math-core';
import { simulate } from '../packages/simulator/src/index';
import {
  DEFAULTS, VARIANTS, compareVariants, defaultBuys, formatTable, parseArgs, type CompareRow,
} from './sim-compare';

const ROOT = resolve(__dirname, '..');
const GAME_DIR = join(ROOT, 'games/game-001');
const loadConfig = () => JSON.parse(readFileSync(join(GAME_DIR, 'game.json'), 'utf8')) as GameConfig;

const SMALL = { spins: 5_000, seed: 7, buys: 500 };
const META = { gameName: 'Test Game', spins: 1_000_000, seed: 20261109, buys: 100_000 };
const row = (over: Partial<CompareRow> = {}): CompareRow => ({
  variant: 'A', rtp: 0.9648, rtpCi90: 0.012, hitRate: 0.3852, freeSpinsOneIn: 140.4, volatilityIndex: 7.144, buyRtp: 0.9541, ...over,
});
const cellsOf = (line: string) => line.split(' | ').map(s => s.trim());

/** parseArgs checks game.json relative to the cwd, so tests pass the absolute game dir. */
const args = (...a: string[]) => parseArgs([GAME_DIR, ...a]);

describe('defaults (AC 1, 8)', () => {
  it('declares the spec defaults', () => {
    expect(VARIANTS).toEqual(['A', 'B', 'C', 'D']);
    expect(DEFAULTS).toMatchObject({ gameDir: 'games/game-001', spins: 1_000_000, seed: 20261109, minBuys: 10_000, buysPerSpin: 0.1 });
  });
  it('defaultBuys follows max(10k, floor(spins/10))', () => {
    expect(defaultBuys(1_000_000)).toBe(100_000);
    expect(defaultBuys(50_000)).toBe(10_000);
    expect(defaultBuys(10_000_000)).toBe(1_000_000);
    expect(defaultBuys(1)).toBe(10_000);
  });
  it('no flags gives 1M spins, seed, 100k buys, A-D', () => {
    expect(args()).toEqual({ gameDir: GAME_DIR, spins: 1_000_000, seed: 20261109, buys: 100_000, variants: ['A', 'B', 'C', 'D'] });
  });
});

describe('parseArgs flags (AC 8)', () => {
  it('overrides spins, seed, buys', () => {
    expect(args('--spins', '20000', '--seed', '5', '--buys', '300')).toMatchObject({ spins: 20000, seed: 5, buys: 300 });
  });
  it('derives buys from spins when --buys is missing', () => {
    expect(args('--spins', '200000').buys).toBe(20_000);
    expect(args('--spins', '20000').buys).toBe(10_000);
  });
  it('accepts --buys 0', () => {
    expect(args('--buys', '0').buys).toBe(0);
  });
  it('positional gameDir is used', () => {
    expect(parseArgs([GAME_DIR]).gameDir).toBe(GAME_DIR);
  });
  it('--variants keeps the order given', () => {
    expect(args('--variants', 'D,A').variants).toEqual(['D', 'A']);
    expect(args('--variants', 'A,C').variants).toEqual(['A', 'C']);
  });
  it('--variants drops duplicates and upper-cases', () => {
    expect(args('--variants', 'A,A').variants).toEqual(['A']);
    expect(args('--variants', 'a,c').variants).toEqual(['A', 'C']);
  });
  it('flags may come before the gameDir', () => {
    expect(parseArgs(['--spins', '100', GAME_DIR]).spins).toBe(100);
  });
});

describe('parseArgs bad input throws with usage (AC 9)', () => {
  const bad: Array<[string, string[]]> = [
    ['spins abc', ['--spins', 'abc']],
    ['spins 0', ['--spins', '0']],
    ['spins negative', ['--spins', '-5']],
    ['spins fractional', ['--spins', '10.5']],
    ['spins missing value', ['--spins']],
    ['seed abc', ['--seed', 'abc']],
    ['seed missing value', ['--seed']],
    ['buys negative', ['--buys', '-1']],
    ['buys abc', ['--buys', 'abc']],
    ['unknown variant e', ['--variants', 'e']],
    ['unknown variant in list', ['--variants', 'A,X']],
    ['variants missing value', ['--variants']],
    ['unknown flag', ['--rounds', '5']],
  ];
  it.each(bad)('%s', (_name, a) => {
    expect(() => args(...a)).toThrow(/Usage:/);
  });
  it('gameDir without game.json', () => {
    expect(() => parseArgs([join(ROOT, 'no-such-game')])).toThrow(/No game\.json[\s\S]*Usage:/);
  });
  it('second positional argument', () => {
    expect(() => parseArgs([GAME_DIR, GAME_DIR])).toThrow(/Usage:/);
  });
});

describe('compareVariants', () => {
  it('matches a direct simulate() call for variant B (AC 4)', () => {
    const config = loadConfig();
    const [r] = compareVariants(config, { ...SMALL, variants: ['B'] });
    const m = simulate(config, { variant: 'B', ...SMALL, sessions: 0, sessionBalance: 1000, sessionBet: 10, sessionMaxSpins: 500 });
    expect(r.variant).toBe('B');
    expect(r.rtp).toBe(m.main.rtp);
    expect(r.rtpCi90).toBe(m.main.ci90);
    expect(r.hitRate).toBe(m.main.hits / m.main.rounds);
    expect(r.freeSpinsOneIn).toBe(m.main.fsTriggers ? m.main.rounds / m.main.fsTriggers : null);
    expect(r.volatilityIndex).toBe(m.main.sd);
    expect(r.buyRtp).toBe(m.buy?.rtp ?? null);
  });
  it('rows come out in the requested order, one per variant', () => {
    const rows = compareVariants(loadConfig(), { spins: 2_000, seed: 3, buys: 100, variants: ['D', 'A'] });
    expect(rows.map(r => r.variant)).toEqual(['D', 'A']);
  });
  it('the variant is really applied (A and D differ)', () => {
    const rows = compareVariants(loadConfig(), { spins: 5_000, seed: 3, buys: 0, variants: ['A', 'D'] });
    expect(rows[0].rtp).not.toBe(rows[1].rtp);
  });
  it('does not mutate the input config (AC 7)', () => {
    const config = loadConfig();
    const before = JSON.parse(JSON.stringify(config));
    compareVariants(config, { spins: 2_000, seed: 3, buys: 100, variants: ['B', 'C', 'D'] });
    expect(config).toEqual(before);
    expect(config.multiplier.variant).toBe('A');
  });
  it('is deterministic (AC 11)', () => {
    const run = () => formatTable(compareVariants(loadConfig(), { spins: 3_000, seed: 11, buys: 200, variants: ['A', 'B'] }), META);
    expect(run()).toBe(run());
  });
  it('calls onVariantDone once per variant, in order', () => {
    const seen: string[] = [];
    compareVariants(loadConfig(), {
      spins: 1_000, seed: 1, buys: 0, variants: ['C', 'B'],
      onVariantDone: (r, ms) => { seen.push(r.variant); expect(ms).toBeGreaterThanOrEqual(0); },
    });
    expect(seen).toEqual(['C', 'B']);
  });
  it('writes nothing under games/game-001/reports (AC 6)', () => {
    const snap = () => {
      const dir = join(GAME_DIR, 'reports');
      if (!existsSync(dir)) return [];
      const out: string[] = [];
      const walk = (d: string) => readdirSync(d, { withFileTypes: true }).forEach(e => {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else { const s = statSync(p); out.push(`${p}|${s.size}|${s.mtimeMs}`); }
      });
      walk(dir);
      return out.sort();
    };
    const before = snap();
    compareVariants(loadConfig(), { spins: 2_000, seed: 3, buys: 100, variants: ['A'] });
    expect(snap()).toEqual(before);
  });
  it('source uses no node:fs write function (AC 6)', () => {
    const src = readFileSync(join(__dirname, 'sim-compare.ts'), 'utf8');
    for (const fn of ['writeFileSync', 'mkdirSync', 'appendFileSync', 'createWriteStream', 'rmSync', 'renameSync', 'copyFileSync']) {
      expect(src).not.toContain(fn);
    }
  });
});

describe('missing data shows "-" (AC 10)', () => {
  it('buys 0 gives null buy RTP and "-" in the table', () => {
    const [r] = compareVariants(loadConfig(), { spins: 2_000, seed: 3, buys: 0, variants: ['A'] });
    expect(r.buyRtp).toBeNull();
    expect(cellsOf(formatTable([r], META).split('\n')[2])[5]).toBe('-');
  });
  it('buyBonus disabled gives "-"', () => {
    const config = loadConfig();
    config.buyBonus.enabled = false;
    const [r] = compareVariants(config, { spins: 2_000, seed: 3, buys: 500, variants: ['A'] });
    expect(r.buyRtp).toBeNull();
    expect(cellsOf(formatTable([r], META).split('\n')[2])[5]).toBe('-');
  });
  it('zero free spin triggers gives null and "-"', () => {
    const [r] = compareVariants(loadConfig(), { spins: 5, seed: 3, buys: 0, variants: ['A'] });
    expect(r.freeSpinsOneIn).toBeNull();
    expect(cellsOf(formatTable([r], META).split('\n')[2])[3]).toBe('-');
  });
  it('NaN and Infinity never print', () => {
    const text = formatTable([row({ rtp: NaN, hitRate: Infinity, freeSpinsOneIn: Infinity, volatilityIndex: NaN, buyRtp: NaN, rtpCi90: NaN })], META);
    expect(text).not.toMatch(/NaN|Infinity/);
    expect(cellsOf(text.split('\n')[2])).toEqual(['A', '-', '-', '-', '-', '-']);
  });
  it('output is plain ASCII except the plus-minus sign', () => {
    const text = formatTable([row({ buyRtp: null, freeSpinsOneIn: null })], META);
    expect(text.replace(/±/g, '')).toMatch(/^[\x00-\x7f]*$/);
  });
});

describe('formatTable (AC 2, 3)', () => {
  const rows = [row(), row({ variant: 'B', rtp: 1.0075, rtpCi90: 0.0123, hitRate: 0.4, freeSpinsOneIn: 99.5, volatilityIndex: 18.1, buyRtp: 1.0076 })];
  const lines = formatTable(rows, META).split('\n');

  it('header line names game, rounds, buys, seed', () => {
    expect(lines[0]).toBe('Test Game: 1,000,000 rounds per variant, 100,000 buys, seed 20261109');
  });
  it('column titles in order', () => {
    expect(cellsOf(lines[1])).toEqual(['Variant', 'RTP', 'Hit rate', 'Free spins', 'Volatility', 'Buy RTP']);
  });
  it('formats cells', () => {
    expect(cellsOf(lines[2])).toEqual(['A', '96.48%', '38.52%', '1 in 140', '7.14', '95.41%']);
    expect(cellsOf(lines[3])).toEqual(['B', '100.75%', '40.00%', '1 in 100', '18.10', '100.76%']);
  });
  it('columns line up', () => {
    const pipes = (l: string) => [...l].map((c, i) => (c === '|' ? i : -1)).filter(i => i >= 0);
    expect(pipes(lines[2])).toEqual(pipes(lines[1]));
    expect(pipes(lines[3])).toEqual(pipes(lines[1]));
  });
  it('one row per variant plus header and footer', () => {
    expect(lines).toHaveLength(2 + rows.length + 1);
  });
  it('footer shows the largest margin and the sign-off note', () => {
    expect(lines[lines.length - 1]).toBe('RTP margin at this size: ± 1.23% (90%). Sign-off still needs npm.cmd run sim at 10M rounds.');
  });
});

describe('CLI (AC 9, 11, import guard)', () => {
  const run = (argv: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'tools/sim-compare.ts', ...argv], { cwd: ROOT, encoding: 'utf8', timeout: 55_000 });

  it('importing the module starts no sim', () => {
    expect(typeof compareVariants).toBe('function');
  });
  it.each([
    ['spins 0', ['--spins', '0']],
    ['spins abc', ['--spins', 'abc']],
    ['seed abc', ['--seed', 'abc']],
    ['variant e', ['--variants', 'e']],
    ['missing game', ['games/does-not-exist']],
  ])('exit 2 with usage on stderr: %s', (_n, argv) => {
    const r = run(argv);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('Usage:');
    expect(r.stdout).toBe('');
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
  it('small run prints one table on stdout, exit 0, progress on stderr', () => {
    const r = run(['--spins', '3000', '--buys', '100', '--variants', 'D,A']);
    expect(r.status).toBe(0);
    const out = r.stdout.trimEnd().split('\n');
    expect(out).toHaveLength(5);
    expect(out[2].startsWith('D')).toBe(true);
    expect(out[3].startsWith('A')).toBe(true);
    expect(r.stderr).toContain('variant D done');
  });
  it('same args give the same stdout (AC 11)', () => {
    const a = run(['--spins', '2000', '--buys', '50', '--variants', 'B']);
    const b = run(['--spins', '2000', '--buys', '50', '--variants', 'B']);
    expect(a.stdout).toBe(b.stdout);
  });
});
