import { describe, expect, it } from 'vitest';
import {
  applyOverrides, buyPriceX, ConfigError, GoldBank, goldBankMode, goldBankPatch, LadderMultiplier, payScale,
  pickBadge, ReelState, SeededRng, SlotEngine, validateConfig,
} from '../src';
import type { CascadeStep, GameConfig, GoldBankConfig, IRng, RoundResult, SpinOutcome } from '../src';
import gameJson from '../../../games/game-001/game.json';
import { testConfig } from './fixtures';

/** Gold bank block for tests: every golden card gets a x5 badge unless a test says otherwise. */
function bankBlock(over: Partial<GoldBankConfig> = {}): GoldBankConfig {
  return {
    enabled: true, badgeChanceBase: 1, badgeChanceFree: 1,
    valuesBase: [{ v: 5, w: 1 }], valuesFree: [{ v: 5, w: 1 }],
    carryInFree: false, ...over,
  };
}

/** Test config with golden cards on every eligible cell and the bank on. */
function bankConfig(over: Partial<GoldBankConfig> = {}, extra: Partial<GameConfig> = {}): GameConfig {
  const c = testConfig(extra);
  c.golden = { enabled: true, reels: [1, 2, 3], chanceBase: 1, chanceFree: 1 };
  c.goldBank = bankBlock(over);
  return c;
}

/** Wraps an RNG and counts how many numbers were drawn. */
class CountingRng implements IRng {
  draws = 0;
  constructor(private readonly inner: IRng) {}
  nextFloat(): number { this.draws++; return this.inner.nextFloat(); }
  nextInt(max: number): number { this.draws++; return this.inner.nextInt(max); }
}

const allSpins = (r: RoundResult): { spin: SpinOutcome; free: boolean }[] => [
  ...(r.base ? [{ spin: r.base, free: false }] : []),
  ...(r.freeSpins ? r.freeSpins.spins.map(spin => ({ spin, free: true })) : []),
];

/** Bank at the end of a spin: the last step's bank plus what that step banked. */
const endBank = (s: SpinOutcome): number => {
  const last = s.steps[s.steps.length - 1];
  return (last.bank ?? 0) + (last.banked ?? []).reduce((a, b) => a + b.value, 0);
};

describe('criterion 1-2: bank off changes nothing', () => {
  it('matches the pre-bank fingerprint on game-001 (bank block present, enabled: false)', () => {
    const config = gameJson as unknown as GameConfig;
    expect(config.goldBank?.enabled).toBe(false);
    let h = 0x811c9dc5;
    const feed = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
    const e1 = new SlotEngine(config, new SeededRng(424242));
    for (let i = 0; i < 2000; i++) feed(JSON.stringify(e1.playRound({ bet: 10, detail: 'full' })));
    const e2 = new SlotEngine(config, new SeededRng(424243));
    for (let i = 0; i < 200; i++) feed(JSON.stringify(e2.playRound({ bet: 10, detail: 'full', buyBonus: true })));
    // Computed with the code before the gold bank existed.
    expect(h.toString(16).padStart(8, '0')).toBe('8e6f141a');
  });

  it('gives identical rounds and the same RNG draws with no block and with enabled: false', () => {
    const plain = testConfig(); plain.golden.chanceBase = 0.4; plain.golden.chanceFree = 0.4;
    const off = structuredClone(plain);
    off.goldBank = bankBlock({ enabled: false });
    const rngA = new CountingRng(new SeededRng(11));
    const rngB = new CountingRng(new SeededRng(11));
    const a = new SlotEngine(plain, rngA);
    const b = new SlotEngine(off, rngB);
    for (let i = 0; i < 300; i++) {
      const req = { bet: 10, detail: 'full' as const, buyBonus: i % 10 === 0 };
      const ra = a.playRound(req);
      const rb = b.playRound(req);
      expect(rb).toStrictEqual(ra);
      expect(JSON.stringify(rb)).toBe(JSON.stringify(ra));
    }
    expect(rngB.draws).toBe(rngA.draws);
    const text = JSON.stringify(b.playRound({ bet: 10 }));
    expect(text).not.toContain('"bank"');
    expect(text).not.toContain('"banked"');
    expect(text).not.toContain('"b":');
  });
});

describe('criterion 3-4: badge rolls', () => {
  const stops = [0, 0, 0, 0, 0];
  const draws = (c: GameConfig, goldenChance: number, withBadge: boolean) => {
    const rng = new CountingRng(new SeededRng(5));
    const gb = c.goldBank!;
    const reels = new ReelState(c, c.reelSets.base, rng, goldenChance, stops,
      withBadge ? { chance: gb.badgeChanceBase, values: gb.valuesBase } : undefined);
    return { draws: rng.draws, reels };
  };

  it('draws two numbers per golden cell (chance, then value) and none for other cells', () => {
    const c = bankConfig();
    const { draws: n, reels } = draws(c, 1, true);
    // Reels 1-3 are eligible: 12 cells, all golden (A B C D). 12 golden draws + 12 x 2 badge draws.
    expect(n).toBe(12 + 24);
    expect(reels.grid[1].every(cell => cell.g && cell.b === 5)).toBe(true);
    expect(reels.grid[0].every(cell => !cell.g && cell.b === undefined)).toBe(true);
  });

  it('makes no extra draw when no cell is golden, when the chance is 0, or when the bank is off', () => {
    expect(draws(bankConfig(), 0, true).draws).toBe(0);
    expect(draws(bankConfig({ badgeChanceBase: 0 }), 1, true).draws).toBe(12);
    expect(draws(bankConfig(), 1, false).draws).toBe(12);
  });

  it('draws only the chance when the roll misses, and gives the cell no badge', () => {
    const c = bankConfig({ badgeChanceBase: 0.5 });
    const rng = new CountingRng(new SeededRng(9));
    const reels = new ReelState(c, c.reelSets.base, rng, 1, stops, { chance: 0.5, values: [{ v: 5, w: 1 }] });
    const badged = reels.grid.flat().filter(x => x.b !== undefined).length;
    expect(rng.draws).toBe(12 + 12 + badged);
  });

  it('snapshot copies b only when it is set', () => {
    const c = bankConfig({ badgeChanceBase: 0.5 });
    const reels = new ReelState(c, c.reelSets.base, new SeededRng(9), 1, stops, { chance: 0.5, values: [{ v: 5, w: 1 }] });
    const snap = reels.snapshot();
    for (const cell of snap.flat()) expect('b' in cell).toBe(cell.b !== undefined);
    expect(snap.flat().some(x => x.b === 5)).toBe(true);
    expect(snap.flat().some(x => x.b === undefined)).toBe(true);
  });

  it('keeps a badge on a golden cell that falls in a cascade', () => {
    const c = bankConfig();
    const reels = new ReelState(c, c.reelSets.base, new SeededRng(9), 1, stops, { chance: 1, values: [{ v: 5, w: 1 }] });
    // Reel 1: A B C D, all golden with a badge. Remove the bottom cell: the other three fall one row.
    const remove = reels.grid.map(() => [false, false, false, true]);
    reels.collapse(remove);
    expect(reels.grid[1].slice(1).map(x => x.s)).toEqual(['A', 'B', 'C']);
    expect(reels.grid[1].slice(1).every(x => x.g && x.b === 5)).toBe(true);
  });
});

describe('pickBadge', () => {
  const values = [{ v: 2, w: 1 }, { v: 3, w: 2.5 }, { v: 9, w: 0.5 }];
  it('picks by cumulative weight', () => {
    expect(pickBadge(values, 0)).toBe(2);
    expect(pickBadge(values, 0.24)).toBe(2); // 0.24 * 4 = 0.96 < 1
    expect(pickBadge(values, 0.25)).toBe(3); // exactly on the edge of the first weight
    expect(pickBadge(values, 0.87)).toBe(3); // 3.48 < 3.5
    expect(pickBadge(values, 0.88)).toBe(9);
    expect(pickBadge(values, 0.999999)).toBe(9);
  });
});

describe('criterion 6: the multiplier plus the bank', () => {
  it('gives x1, x7, x11 for ladder x1 x2 x3 x5 with badges x5 then x3', () => {
    const ladder = new LadderMultiplier([1, 2, 3, 5], [2, 4, 6, 10]);
    const bank = new GoldBank(bankBlock());
    ladder.startSpin(false);
    bank.startSpin(false);
    const seen: number[] = [];
    for (const badge of [5, 3]) {
      seen.push(ladder.multiplierFor() + bank.value);
      ladder.afterWin();
      bank.add(badge);
    }
    seen.push(ladder.multiplierFor() + bank.value);
    expect(seen).toEqual([1, 7, 11]);
    // A no-win last step shows the ladder plus the bank as well.
    ladder.afterWin();
    expect(ladder.current() + bank.value).toBe(5 + 8);
  });
});

describe('GoldBank reset and carry rules', () => {
  it('resets on every spin in reset mode', () => {
    const b = new GoldBank(bankBlock({ carryInFree: false }));
    b.add(7); b.startSpin(true);
    expect(b.value).toBe(0);
  });
  it('keeps the value across free spins in carry mode, clears on a base spin or feature start', () => {
    const b = new GoldBank(bankBlock({ carryInFree: true }));
    b.add(7); b.startSpin(true);
    expect(b.value).toBe(7);
    b.startSpin(false);
    expect(b.value).toBe(0);
    b.add(4); b.startFeature();
    expect(b.value).toBe(0);
  });
  it('is switched off with no block or enabled: false', () => {
    expect(new GoldBank(undefined).enabled).toBe(false);
    expect(new GoldBank(bankBlock({ enabled: false })).enabled).toBe(false);
  });
});

describe('criterion 5, 7: engine invariants (variant A, badge chance 1)', () => {
  const c = bankConfig({}, {});
  const ladderOf = (isFree: boolean, k: number) => {
    const l = isFree ? c.multiplier.A.free : c.multiplier.A.base;
    return l[Math.min(k, l.length - 1)];
  };

  it('multiplier = ladder + bank, and the bank grows by what was banked', () => {
    const engine = new SlotEngine(c, new SeededRng(31));
    let bankedAny = false;
    for (let i = 0; i < 500; i++) {
      const r = engine.playRound({ bet: 10, buyBonus: i % 5 === 0 });
      for (const { spin, free } of allSpins(r)) {
        spin.steps.forEach((s: CascadeStep, k: number) => {
          expect(s.bank).toBeDefined();
          expect(s.multiplier).toBe(ladderOf(free, k) + s.bank!);
          const next = spin.steps[k + 1];
          if (next) expect(next.bank).toBe(s.bank! + s.banked!.reduce((a, b) => a + b.value, 0));
          if (s.banked!.length) bankedAny = true;
        });
      }
    }
    expect(bankedAny).toBe(true);
  });

  it('banks each winning badge once, then the cell is wild without a badge', () => {
    const engine = new SlotEngine(c, new SeededRng(32));
    for (let i = 0; i < 300; i++) {
      const r = engine.playRound({ bet: 10 });
      for (const { spin } of allSpins(r)) {
        for (const s of spin.steps) {
          const grid = s.grid!;
          const keys = s.banked!.map(b => `${b.pos.reel}:${b.pos.row}`);
          expect(new Set(keys).size).toBe(keys.length);
          for (const b of s.banked!) {
            expect(grid[b.pos.reel][b.pos.row].b).toBe(b.value);
            expect(s.toWild.some(p => p.reel === b.pos.reel && p.row === b.pos.row)).toBe(true);
          }
          // Golden winners with a badge are all banked.
          const withBadge = s.toWild.filter(p => grid[p.reel][p.row].b !== undefined);
          expect(withBadge.length).toBe(s.banked!.length);
          // Only golden cells carry a badge.
          for (const cell of grid.flat()) if (cell.b !== undefined) expect(cell.g).toBe(true);
        }
      }
    }
  });
});

describe('criterion 8: reset and carry through free spins', () => {
  it('reset: every spin starts at bank 0', () => {
    const engine = new SlotEngine(bankConfig({ carryInFree: false }), new SeededRng(41));
    let freeSpinsSeen = 0;
    for (let i = 0; i < 300; i++) {
      const r = engine.playRound({ bet: 10, buyBonus: i % 3 === 0 });
      for (const { spin, free } of allSpins(r)) {
        expect(spin.steps[0].bank).toBe(0);
        if (free) freeSpinsSeen++;
      }
    }
    expect(freeSpinsSeen).toBeGreaterThan(20);
  });

  it('carry: base and the first free spin start at 0, later free spins continue, a buy starts at 0', () => {
    // A very high cap and small badges keep rounds from ending early, so the bank has time to carry.
    const c = bankConfig({ carryInFree: true, valuesFree: [{ v: 2, w: 1 }] }, { maxWinX: 1e9 });
    c.golden.chanceFree = 0.3;
    const engine = new SlotEngine(c, new SeededRng(42));
    let carried = 0;
    for (let i = 0; i < 400; i++) {
      const buy = i % 3 === 0;
      const r = engine.playRound({ bet: 10, buyBonus: buy, force: buy ? undefined : { triggerFreeSpins: true } });
      if (r.base) expect(r.base.steps[0].bank).toBe(0);
      const fs = r.freeSpins?.spins ?? [];
      fs.forEach((spin, k) => {
        if (k === 0) { expect(spin.steps[0].bank).toBe(0); return; }
        const prevEnd = endBank(fs[k - 1]);
        expect(spin.steps[0].bank).toBe(prevEnd);
        if (prevEnd > 0) carried++;
      });
    }
    expect(carried).toBeGreaterThan(20);
  });

  it('carry: a retrigger does not reset the bank', () => {
    const c = bankConfig({ carryInFree: true, valuesFree: [{ v: 2, w: 1 }] }, { maxWinX: 1e9 });
    c.golden.chanceFree = 0.3;
    c.freeSpins.spins = 3;
    const engine = new SlotEngine(c, new SeededRng(43));
    let retriggered = 0;
    for (let i = 0; i < 2000 && retriggered < 3; i++) {
      const r = engine.playRound({ bet: 10, buyBonus: true });
      if (!r.freeSpins || r.freeSpins.retriggers === 0) continue;
      retriggered++;
      const fs = r.freeSpins.spins;
      for (let k = 1; k < fs.length; k++) expect(fs[k].steps[0].bank).toBe(endBank(fs[k - 1]));
    }
    expect(retriggered).toBeGreaterThan(0);
  });
});

describe('criterion 9: the max win cap still holds', () => {
  it('never pays above maxWinX with huge badges and reports the cap', () => {
    const c = bankConfig({ valuesBase: [{ v: 1000, w: 1 }], valuesFree: [{ v: 1000, w: 1 }] }, { maxWinX: 3 });
    const engine = new SlotEngine(c, new SeededRng(51));
    let capped = 0;
    for (let i = 0; i < 300; i++) {
      const r = engine.playRound({ bet: 10, buyBonus: i % 4 === 0 });
      expect(r.totalWin).toBeLessThanOrEqual(30);
      if (r.maxWinReached) capped++;
      for (const { spin } of allSpins(r)) for (const s of spin.steps) expect(s.banked).toBeDefined();
    }
    expect(capped).toBeGreaterThan(0);
  });
});

describe('criterion 10: validateConfig', () => {
  const problemsOf = (mutate: (b: GoldBankConfig) => void): string => {
    const c = testConfig();
    c.goldBank = bankBlock({ enabled: false });
    mutate(c.goldBank);
    try { validateConfig(c); } catch (e) { expect(e).toBeInstanceOf(ConfigError); return (e as ConfigError).message; }
    return '';
  };

  it('accepts a good block, enabled or not', () => {
    expect(problemsOf(() => undefined)).toBe('');
  });
  it('rejects chances outside 0..1', () => {
    expect(problemsOf(b => { b.badgeChanceBase = 1.1; })).toContain('goldBank.badgeChanceBase must be between 0 and 1');
    expect(problemsOf(b => { b.badgeChanceFree = -0.1; })).toContain('goldBank.badgeChanceFree must be between 0 and 1');
  });
  it('rejects empty value lists, weights <= 0 and values < 2 or not finite', () => {
    expect(problemsOf(b => { b.valuesBase = []; })).toContain('goldBank.valuesBase must not be empty');
    expect(problemsOf(b => { b.valuesFree = []; })).toContain('goldBank.valuesFree must not be empty');
    expect(problemsOf(b => { b.valuesBase = [{ v: 2, w: 0 }]; })).toContain('valuesBase[0].w must be greater than 0');
    expect(problemsOf(b => { b.valuesFree = [{ v: 2, w: -1 }]; })).toContain('valuesFree[0].w must be greater than 0');
    expect(problemsOf(b => { b.valuesBase = [{ v: 1, w: 1 }]; })).toContain('valuesBase[0].v must be a number of at least 2');
    expect(problemsOf(b => { b.valuesBase = [{ v: Infinity, w: 1 }]; })).toContain('valuesBase[0].v');
    expect(problemsOf(b => { b.valuesBase = [{ v: NaN, w: 1 }]; })).toContain('valuesBase[0].v');
  });
  it('rejects tuning that is not above 0', () => {
    expect(problemsOf(b => { b.tuning = { reset: { payScale: 0 } }; })).toContain('goldBank.tuning.reset.payScale');
    expect(problemsOf(b => { b.tuning = { carry: { buyPriceX: -5 } }; })).toContain('goldBank.tuning.carry.buyPriceX');
    expect(problemsOf(b => { b.tuning = { reset: { buyPriceX: 0 } }; })).toContain('goldBank.tuning.reset.buyPriceX');
    expect(problemsOf(b => { b.tuning = { carry: { payScale: NaN } }; })).toContain('goldBank.tuning.carry.payScale');
  });
});

describe('criterion 11: pay scale and buy price', () => {
  const tuned = (): GameConfig => {
    const c = bankConfig({}, {});
    c.multiplier.payScale = { A: 0.9 };
    c.goldBank!.tuning = { reset: { payScale: 0.5, buyPriceX: 70 }, carry: { payScale: 0.4, buyPriceX: 90 } };
    return c;
  };
  it('multiplies the variant scale by the mode scale and replaces the buy price', () => {
    const reset = tuned();
    expect(payScale(reset)).toBeCloseTo(0.45);
    expect(buyPriceX(reset)).toBe(70);
    const carry = tuned(); carry.goldBank!.carryInFree = true;
    expect(payScale(carry)).toBeCloseTo(0.36);
    expect(buyPriceX(carry)).toBe(90);
  });
  it('falls back to the variant price and a scale of 1 when tuning is missing', () => {
    const c = bankConfig({}, {});
    c.buyBonus.priceXByVariant = { A: 55 };
    expect(payScale(c)).toBe(1);
    expect(buyPriceX(c)).toBe(55);
  });
  it('returns today\'s numbers with the bank off', () => {
    const c = tuned(); c.goldBank!.enabled = false;
    expect(payScale(c)).toBe(0.9);
    expect(buyPriceX(c)).toBe(50);
  });
});

describe('goldBankMode and goldBankPatch', () => {
  it('reads the mode and builds session patches', () => {
    const c = bankConfig({}, {});
    expect(goldBankMode(c)).toBe('reset');
    expect(goldBankMode(applyOverrides(c, goldBankPatch('carry')).config)).toBe('carry');
    expect(goldBankMode(applyOverrides(c, goldBankPatch('off')).config)).toBe('off');
    expect(goldBankMode(testConfig())).toBe('off');
  });
});

describe('criterion 12: every variant plays with the bank on', () => {
  for (const carryInFree of [false, true]) {
    for (const variant of ['A', 'B', 'C', 'D'] as const) {
      it(`variant ${variant}, ${carryInFree ? 'carry' : 'reset'}: 200 rounds without throwing`, () => {
        const c = bankConfig({ carryInFree, badgeChanceBase: 0.5, badgeChanceFree: 0.5 });
        c.multiplier.variant = variant;
        c.golden.chanceBase = 0.3; c.golden.chanceFree = 0.3;
        const engine = new SlotEngine(c, new SeededRng(61));
        for (let i = 0; i < 200; i++) {
          const r = engine.playRound({ bet: 10, buyBonus: i % 10 === 0 });
          expect(r.variant).toBe(variant);
          expect(Number.isFinite(r.totalWin)).toBe(true);
        }
      });
    }
  }
});

describe('maxCascades guard', () => {
  it('ends the spin with the bank on', () => {
    const c = bankConfig({}, { maxCascades: 2 });
    const engine = new SlotEngine(c, new SeededRng(71));
    for (let i = 0; i < 200; i++) {
      const r = engine.playRound({ bet: 10 });
      for (const { spin } of allSpins(r)) expect(spin.steps.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('summary detail', () => {
  it('still carries bank and banked on steps', () => {
    const engine = new SlotEngine(bankConfig(), new SeededRng(81));
    let seen = false;
    for (let i = 0; i < 100; i++) {
      const r = engine.playRound({ bet: 10, detail: 'summary' });
      for (const { spin } of allSpins(r)) for (const s of spin.steps) { expect(s.grid).toBeUndefined(); expect(s.bank).toBeDefined(); if (s.banked!.length) seen = true; }
    }
    expect(seen).toBe(true);
  });
});
