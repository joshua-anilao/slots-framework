import { describe, expect, it } from 'vitest';
import { WaysEvaluator } from '../src';
import { gridFromRows, testConfig } from './fixtures';

describe('WaysEvaluator', () => {
  const ev = new WaysEvaluator(testConfig());

  it('pays 3 of a kind on adjacent reels from the left', () => {
    const grid = gridFromRows([
      'A A A B C',
      'B C D C D',
      'C D B D B',
      'D B C B C',
    ]);
    const wins = ev.evaluate(grid, 10);
    const a = wins.find(w => w.symbol === 'A')!;
    expect(a.count).toBe(3);
    expect(a.ways).toBe(1);
    expect(a.baseWin).toBe(10); // 1x bet per way * 1 way * 10
  });

  it('multiplies ways by matches per reel', () => {
    const grid = gridFromRows([
      'A A A A C',
      'A B A D D',
      'C D B D B',
      'D B C B C',
    ]);
    const a = ev.evaluate(grid, 1).find(w => w.symbol === 'A')!;
    expect(a.count).toBe(4);
    expect(a.ways).toBe(2 * 1 * 2 * 1);
    expect(a.baseWin).toBe(2 * 4);
    expect(a.positions).toHaveLength(6);
  });

  it('lets wilds substitute but never pays scatters', () => {
    const grid = gridFromRows([
      'A W A SC SC',
      'B C D C D',
      'C D B D SC',
      'D B C B C',
    ]);
    const wins = ev.evaluate(grid, 1);
    expect(wins.find(w => w.symbol === 'A')?.count).toBe(3);
    expect(wins.find(w => w.symbol === 'SC')).toBeUndefined();
  });

  it('needs the first reel', () => {
    const grid = gridFromRows([
      'B A A A A',
      'B C D C D',
      'C D B D B',
      'D B C B C',
    ]);
    expect(ev.evaluate(grid, 1).find(w => w.symbol === 'A')).toBeUndefined();
  });
});
