import { describe, expect, it } from 'vitest';
import { applyOverrides, ConfigError, ReelState, SeededRng, SlotEngine } from '../src';
import { testConfig } from './fixtures';

describe('ReelState', () => {
  it('shows the strip from the stop position and refills from above', () => {
    const c = testConfig();
    const strip = c.reelSets.base[0]; // A B C D A B C D SC A B C
    const reels = new ReelState(c, c.reelSets.base, new SeededRng(1), 0, [4, 4, 4, 4, 4]);
    expect(reels.grid[0].map(x => x.s)).toEqual(['A', 'B', 'C', 'D']);
    const remove = reels.grid.map(() => [false, true, false, false]);
    reels.collapse(remove);
    // B removed: A falls down one row; the symbol above the stop (strip[3] = D) drops in on top.
    expect(reels.grid[0].map(x => x.s)).toEqual([strip[3], 'A', 'C', 'D']);
  });
});

describe('SlotEngine', () => {
  it('replays the same rounds from the same seed', () => {
    const c = testConfig();
    const a = new SlotEngine(c, new SeededRng(99));
    const b = new SlotEngine(c, new SeededRng(99));
    for (let i = 0; i < 200; i++) expect(a.playRound({ bet: 10 })).toEqual(b.playRound({ bet: 10 }));
  });

  it('turns winning golden symbols into wilds instead of removing them', () => {
    const c = testConfig({ golden: { enabled: true, reels: [1, 2, 3], chanceBase: 1, chanceFree: 1 } });
    const engine = new SlotEngine(c, new SeededRng(5));
    let checked = false;
    for (let i = 0; i < 100 && !checked; i++) {
      const r = engine.playRound({ bet: 1 });
      for (const step of r.base!.steps) {
        for (const p of step.toWild) {
          expect(step.removed).not.toContainEqual(p);
          expect([1, 2, 3]).toContain(p.reel);
          checked = true;
        }
      }
    }
    expect(checked).toBe(true);
  });

  it('applies the ladder to cascade steps in order', () => {
    const engine = new SlotEngine(testConfig(), new SeededRng(3));
    for (let i = 0; i < 300; i++) {
      const r = engine.playRound({ bet: 1 });
      const winning = r.base!.steps.filter(s => s.wins.length > 0).map(s => s.multiplier);
      expect(winning).toEqual(winning.map((_, k) => [1, 2, 3, 5][Math.min(k, 3)]));
    }
  });

  it('charges the buy price and goes straight to free spins', () => {
    const engine = new SlotEngine(testConfig(), new SeededRng(8));
    const r = engine.playRound({ bet: 2, buyBonus: true });
    expect(r.cost).toBe(100);
    expect(r.base).toBeNull();
    // 10 spins unless the max-win cap ended the feature early (this test strip pays a lot).
    if (!r.maxWinReached) expect(r.freeSpins!.spins.length).toBeGreaterThanOrEqual(10);
    expect(r.freeSpins!.spins.length).toBeGreaterThan(0);
  });

  it('can force free spins for testing', () => {
    const engine = new SlotEngine(testConfig(), new SeededRng(8));
    const r = engine.playRound({ bet: 1, force: { triggerFreeSpins: true } });
    expect(r.freeSpins).not.toBeNull();
  });

  it('never pays more than the max win cap', () => {
    const c = testConfig({ maxWinX: 3 });
    const engine = new SlotEngine(c, new SeededRng(11));
    let capped = 0;
    for (let i = 0; i < 2000; i++) {
      const r = engine.playRound({ bet: 1 });
      expect(r.totalWin).toBeLessThanOrEqual(3);
      if (r.maxWinReached) capped++;
    }
    expect(capped).toBeGreaterThan(0);
  });

  it('round total equals base plus free spins', () => {
    const engine = new SlotEngine(testConfig(), new SeededRng(21));
    for (let i = 0; i < 500; i++) {
      const r = engine.playRound({ bet: 10 });
      expect(r.totalWin).toBeCloseTo(r.baseWin + r.freeSpinsWin, 2);
    }
  });
});

describe('config', () => {
  it('rejects unknown symbols on strips', () => {
    const c = testConfig();
    c.reelSets.base[0] = ['A', 'B', 'C', 'Z'];
    expect(() => new SlotEngine(c, new SeededRng(1))).toThrow(ConfigError);
  });

  it('applies overrides to a copy and lists what changed', () => {
    const base = testConfig();
    const { config, changed } = applyOverrides(base, { multiplier: { variant: 'B' }, maxWinX: 100 });
    expect(config.multiplier.variant).toBe('B');
    expect(config.maxWinX).toBe(100);
    expect(base.multiplier.variant).toBe('A');
    expect(changed.sort()).toEqual(['maxWinX', 'multiplier.variant']);
  });
});
