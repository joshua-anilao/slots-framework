import { describe, expect, it } from 'vitest';
import { SeededRng } from '../src';

describe('SeededRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = new SeededRng(42), b = new SeededRng(42);
    for (let i = 0; i < 100; i++) expect(a.nextInt(1000)).toBe(b.nextInt(1000));
  });

  it('gives different sequences for different seeds', () => {
    const a = new SeededRng(1), b = new SeededRng(2);
    const sa = Array.from({ length: 20 }, () => a.nextInt(1_000_000));
    const sb = Array.from({ length: 20 }, () => b.nextInt(1_000_000));
    expect(sa).not.toEqual(sb);
  });

  it('stays in range and is roughly uniform', () => {
    const r = new SeededRng(7);
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const v = r.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      counts[v]++;
    }
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
  });
});
