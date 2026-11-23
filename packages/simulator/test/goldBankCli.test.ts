import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// CLI behaviour (criteria 13, 14, 15). Runs against a temp copy of game-001 so reports/ in the repo is never touched.
const root = resolve(__dirname, '../../..');
const tsxCli = join(root, 'node_modules/tsx/dist/cli.mjs');
const cliFile = join(root, 'packages/simulator/src/cli.ts');
let tmp: string;
let gameDir: string;
let noBlockDir: string;

const run = (dir: string, ...extra: string[]) =>
  spawnSync(process.execPath, [tsxCli, cliFile, dir, '--spins', '2000', '--buys', '0', '--sessions', '0', ...extra], {
    cwd: root, encoding: 'utf8', timeout: 120_000,
  });

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'goldbank-cli-'));
  gameDir = join(tmp, 'game');
  noBlockDir = join(tmp, 'noblock');
  for (const dir of [gameDir, noBlockDir]) {
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(root, 'games/game-001/game.json'), join(dir, 'game.json'));
    copyFileSync(join(root, 'games/game-001/strip-weights.json'), join(dir, 'strip-weights.json'));
  }
  const cfg = JSON.parse(readFileSync(join(noBlockDir, 'game.json'), 'utf8'));
  delete cfg.goldBank;
  writeFileSync(join(noBlockDir, 'game.json'), JSON.stringify(cfg));
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('sim --gold-bank flag', () => {
  it('exits 2 with usage on a wrong-case value', () => {
    const r = run(gameDir, '--gold-bank', 'Reset');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('Usage');
  });

  it('exits 2 with usage on a missing value', () => {
    const r = run(gameDir, '--gold-bank');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('Usage');
  });

  it('exits 2 with usage on an unknown value', () => {
    expect(run(gameDir, '--gold-bank', 'on').status).toBe(2);
  });

  it('exits 2 for reset/carry when game.json has no goldBank block, but off is fine', () => {
    for (const mode of ['reset', 'carry']) {
      const r = run(noBlockDir, '--gold-bank', mode);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('Usage');
    }
    expect(run(noBlockDir, '--gold-bank', 'off', '--out', join(tmp, 'o-off')).status).not.toBe(2);
  });

  it('writes bank runs to reports/<variant>-bank-<mode> and never changes game.json', () => {
    const before = readFileSync(join(gameDir, 'game.json'), 'utf8');
    for (const mode of ['reset', 'carry']) {
      const r = run(gameDir, '--gold-bank', mode);
      expect(r.status === 0 || r.status === 1).toBe(true); // 1 = a target missed at 2k rounds, fine
      const dir = join(gameDir, 'reports', `A-bank-${mode}`);
      const s = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
      expect(s.goldBank).toBe(mode);
      expect(s.bank).not.toBeNull();
      expect(r.stdout).toContain(`Gold bank (${mode})`);
      expect(readFileSync(join(dir, 'report.html'), 'utf8')).toContain('Gold bank');
      expect(readFileSync(join(dir, 'par-sheet.csv'), 'utf8')).toContain('GOLD BANK');
    }
    expect(existsSync(join(gameDir, 'reports', 'A'))).toBe(false);
    expect(readFileSync(join(gameDir, 'game.json'), 'utf8')).toBe(before);
  });

  it('--out wins over the bank folder; bank off writes bank: null into reports/A', () => {
    const out = join(tmp, 'custom');
    run(gameDir, '--gold-bank', 'reset', '--out', out);
    expect(existsSync(join(out, 'summary.json'))).toBe(true);
    run(gameDir, '--gold-bank', 'off');
    const s = JSON.parse(readFileSync(join(gameDir, 'reports', 'A', 'summary.json'), 'utf8'));
    expect(s.goldBank).toBe('off');
    expect(s.bank).toBeNull();
  });

  it('without the flag follows game.json (enabled: false means off)', () => {
    const out = join(tmp, 'noflag');
    run(gameDir, '--out', out);
    const s = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
    expect(s.goldBank).toBe('off');
  });
});
