import { describe, expect, it } from 'vitest';
import type { GameConfig } from '@slots/math-core';
import gameJson from '../../../games/game-001/game.json';
import { buildHtmlReport } from '../src/htmlReport';
import { buildParSheet } from '../src/parSheet';
import { simulate } from '../src/simulate';
import type { SimOptions } from '../src/simulate';

const config = gameJson as unknown as GameConfig;
const opts = (over: Partial<SimOptions> = {}): SimOptions => ({
  spins: 20_000, seed: 20261109, buys: 0, sessions: 0, sessionBalance: 1000, sessionBet: 10, sessionMaxSpins: 500, ...over,
});

describe('simulator gold bank stats', () => {
  it('has no bank stats when the bank is off (game.json default and --gold-bank off)', () => {
    for (const goldBank of [undefined, 'off' as const]) {
      const r = simulate(config, opts({ goldBank }));
      expect(r.goldBank).toBe('off');
      expect(r.main.bank).toBeNull();
      expect(buildParSheet(r)).not.toContain('GOLD BANK');
      expect(buildHtmlReport(r)).not.toContain('Gold bank');
    }
  });

  it('fills consistent bank stats in reset and carry mode, without changing the base config', () => {
    for (const mode of ['reset', 'carry'] as const) {
      const r = simulate(config, opts({ goldBank: mode }));
      const b = r.main.bank!;
      expect(r.goldBank).toBe(mode);
      expect(b).not.toBeNull();
      expect(b.badgesBanked).toBeGreaterThan(0);
      expect(b.maxBank).toBeGreaterThanOrEqual(b.avgBankFree);
      expect(b.avgBankFree).toBeGreaterThan(b.avgBankBase);
      expect(b.shareOfRtpFromBankSteps).toBeGreaterThanOrEqual(0);
      expect(b.shareOfRtpFromBankSteps).toBeLessThanOrEqual(1);
      expect(buildParSheet(r)).toContain('GOLD BANK');
      expect(buildHtmlReport(r)).toContain('Gold bank');
      expect(config.goldBank?.enabled).toBe(false);
    }
  });

  it('carry builds a bigger free spins bank than reset', () => {
    const reset = simulate(config, opts({ goldBank: 'reset' })).main.bank!;
    const carry = simulate(config, opts({ goldBank: 'carry' })).main.bank!;
    expect(carry.avgBankFree).toBeGreaterThan(reset.avgBankFree);
  });

  it('rejects a bad mode (including wrong case) and a mode with no goldBank block', () => {
    expect(() => simulate(config, opts({ goldBank: 'Reset' as never }))).toThrow(/Unknown gold bank mode/);
    expect(() => simulate(config, opts({ goldBank: 'on' as never }))).toThrow(/Unknown gold bank mode/);
    const noBlock = structuredClone(config);
    delete noBlock.goldBank;
    expect(() => simulate(noBlock, opts({ goldBank: 'reset' }))).toThrow(/no goldBank/);
    expect(simulate(noBlock, opts({ goldBank: 'off' })).goldBank).toBe('off');
  });
});
