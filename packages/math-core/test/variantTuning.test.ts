import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyOverrides, buyPriceX, payScale, SeededRng, SlotEngine } from '../src';
import type { GameConfig } from '../src';

const base = JSON.parse(readFileSync(new URL('../../../games/game-001/game.json', import.meta.url), 'utf8')) as GameConfig;
const withVariant = (variant: 'A' | 'B' | 'C' | 'D') => applyOverrides(base, { multiplier: { variant } }).config;

describe('per-variant tuning', () => {
  it('reads the pay scale and buy price of the live variant', () => {
    expect(payScale(withVariant('A'))).toBe(1);
    expect(payScale(withVariant('D'))).toBe(0.83);
    expect(buyPriceX(withVariant('A'))).toBe(50);
    expect(buyPriceX(withVariant("D"))).toBe(60);
  });

  it('pay scale scales every win (same seed, same grids)', () => {
    const win = (scale: number) => {
      const cfg = applyOverrides(base, { multiplier: { variant: 'A', payScale: { A: scale } } }).config;
      const e = new SlotEngine(cfg, new SeededRng(5));
      let total = 0;
      for (let i = 0; i < 300; i++) total += e.playRound({ bet: 10 }).totalWin;
      return total;
    };
    const one = win(1);
    expect(one).toBeGreaterThan(0);
    expect(win(2)).toBeCloseTo(one * 2, 0);
  });

  it('rejects a pay scale that is not positive', () => {
    expect(() => applyOverrides(base, { multiplier: { payScale: { B: 0 } } })).toThrow();
  });

  it('buy bonus is charged at the variant price', () => {
    const e = new SlotEngine(withVariant('B'), new SeededRng(3));
    expect(e.playRound({ bet: 10, buyBonus: true }).cost).toBe(515);
  });
});
