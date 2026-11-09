import { describe, expect, it } from 'vitest';
import { applyOverrides, ConfigError, SeededRng, SlotEngine } from '../src';
import { testConfig } from './fixtures';

const allA = Array(12).fill('A');
const allSC = Array(12).fill('SC');
const noWin = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'];
const strips = (s: string[]) => [s, s, s, s, s];
const noWinReels = [noWin, ['C', 'D', 'C', 'D', 'C', 'D', 'C', 'D'], ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'], noWin, noWin];

describe('edge cases: max win cap', () => {
  it('stops the round in the base game when the cap is hit, even if free spins were forced', () => {
    const c = testConfig({ maxWinX: 5, reelSets: { base: strips(allA), free: strips(allA) } });
    const r = new SlotEngine(c, new SeededRng(1)).playRound({ bet: 2, force: { triggerFreeSpins: true } });
    expect(r.maxWinReached).toBe(true);
    expect(r.totalWin).toBe(10);
    expect(r.freeSpins).toBeNull();
  });

  it('stops free spins at the cap and does not play the rest', () => {
    const c = testConfig({ maxWinX: 20, reelSets: { base: noWinReels, free: strips(allA) } });
    const r = new SlotEngine(c, new SeededRng(2)).playRound({ bet: 1, buyBonus: true });
    expect(r.maxWinReached).toBe(true);
    expect(r.totalWin).toBe(20);
    expect(r.freeSpins!.spins.length).toBeLessThan(r.freeSpins!.awarded);
  });

  it('never reports a total above the cap over many rounds', () => {
    const c = testConfig({ maxWinX: 3 });
    const e = new SlotEngine(c, new SeededRng(3));
    for (let i = 0; i < 2000; i++) {
      const r = e.playRound({ bet: 1, buyBonus: i % 5 === 0, detail: 'summary' });
      expect(r.totalWin).toBeLessThanOrEqual(3);
    }
  });
});

describe('edge cases: free spins', () => {
  it('limits retriggers to maxTotalSpins', () => {
    const c = testConfig({ reelSets: { base: noWinReels, free: strips(allSC) } });
    const r = new SlotEngine(c, new SeededRng(4)).playRound({ bet: 1, buyBonus: true });
    expect(r.freeSpins!.awarded).toBe(c.freeSpins.maxTotalSpins);
    expect(r.freeSpins!.spins).toHaveLength(c.freeSpins.maxTotalSpins);
    const shown = r.freeSpins!.spins.reduce((n, s) => n + s.freeSpinsAwarded, 0);
    expect(c.freeSpins.spins + shown).toBe(c.freeSpins.maxTotalSpins);
  });

  it('plays only the first award when retrigger is off', () => {
    const base = testConfig();
    const c = testConfig({ reelSets: { base: noWinReels, free: strips(allSC) }, freeSpins: { ...base.freeSpins, retrigger: false } });
    const r = new SlotEngine(c, new SeededRng(5)).playRound({ bet: 1, buyBonus: true });
    expect(r.freeSpins!.awarded).toBe(c.freeSpins.spins);
    expect(r.freeSpins!.retriggers).toBe(0);
  });

  it('awards extra spins per scatter above the minimum', () => {
    const c = testConfig({ reelSets: { base: strips(allSC), free: strips(noWin) } });
    const r = new SlotEngine(c, new SeededRng(6)).playRound({ bet: 1 });
    // 20 scatters on the grid: 10 + (20 - 3) * 2 = 44
    expect(r.base!.freeSpinsAwarded).toBe(44);
    expect(r.freeSpins!.awarded).toBe(44);
  });
});

describe('edge cases: bad input', () => {
  const e = new SlotEngine(testConfig(), new SeededRng(7));
  it.each([0, -1, Number.NaN])('rejects bet %s', bet => {
    expect(() => e.playRound({ bet })).toThrow();
  });

  it('rejects a buy when the game has no buy bonus', () => {
    const c = testConfig({ buyBonus: { enabled: false, priceX: 50 } });
    expect(() => new SlotEngine(c, new SeededRng(8)).playRound({ bet: 1, buyBonus: true })).toThrow(/not enabled/);
  });

  it('rejects overrides that break the config and leaves the base untouched', () => {
    const base = testConfig();
    const before = JSON.stringify(base);
    expect(() => applyOverrides(base, { golden: { chanceBase: 2 } })).toThrow(ConfigError);
    expect(() => applyOverrides(base, { bet: { defaultIndex: 9 } })).toThrow(ConfigError);
    expect(() => applyOverrides(base, { reelSets: { base: [['A'], ['A'], ['A'], ['A'], ['A']] } })).toThrow(ConfigError);
    expect(JSON.stringify(base)).toBe(before);
  });
});

describe('edge cases: money', () => {
  it('keeps every round total in whole cents and equal to its parts (within a cent)', () => {
    const e = new SlotEngine(testConfig({ golden: { enabled: true, reels: [1, 2, 3], chanceBase: 0.2, chanceFree: 0.4 } }), new SeededRng(9));
    for (let i = 0; i < 3000; i++) {
      const r = e.playRound({ bet: [1, 3, 7][i % 3], buyBonus: i % 10 === 0 });
      expect(Math.round(r.totalWin * 100)).toBeCloseTo(r.totalWin * 100, 6);
      if (!r.maxWinReached) expect(Math.abs(r.totalWin - r.baseWin - r.freeSpinsWin)).toBeLessThan(0.01);
      expect(r.cost).toBe(r.buyBonus ? r.bet * 50 : r.bet);
    }
  });
});
