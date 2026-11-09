import { describe, expect, it } from 'vitest';
import { EndlessMultiplier, LadderMultiplier, PersistentLadderMultiplier, SpotsMultiplier } from '../src';

describe('multiplier variants', () => {
  it('A: climbs the ladder per cascade, holds the last step, resets each spin', () => {
    const m = new LadderMultiplier([1, 2, 3, 5], [2, 4, 6, 10]);
    m.startSpin(false);
    const seen = [];
    for (let i = 0; i < 6; i++) { seen.push(m.multiplierFor()); m.afterWin(); }
    expect(seen).toEqual([1, 2, 3, 5, 5, 5]);
    m.startSpin(true);
    expect(m.current()).toBe(2);
  });

  it('B: endless start + step', () => {
    const m = new EndlessMultiplier({ base: { start: 1, step: 1 }, free: { start: 2, step: 2 } });
    m.startSpin(true);
    const seen = [];
    for (let i = 0; i < 4; i++) { seen.push(m.current()); m.afterWin(); }
    expect(seen).toEqual([2, 4, 6, 8]);
  });

  it('C: keeps climbing across free spins until the feature restarts', () => {
    const m = new PersistentLadderMultiplier([1, 2, 3, 5], [2, 4, 6, 10]);
    m.startFeature();
    m.startSpin(true); m.afterWin();
    m.startSpin(true);
    expect(m.current()).toBe(4);
    m.startFeature(); m.startSpin(true);
    expect(m.current()).toBe(2);
  });

  it('D: marks a cell, then doubles it on later wins', () => {
    const m = new SpotsMultiplier(5, 4, 8);
    m.startSpin(false);
    const p = [{ reel: 0, row: 0 }];
    expect(m.multiplierFor(p)).toBe(1); m.afterWin(p); // marked
    expect(m.multiplierFor(p)).toBe(1); m.afterWin(p); // x2
    expect(m.multiplierFor(p)).toBe(2); m.afterWin(p); // x4
    m.afterWin(p); m.afterWin(p);
    expect(m.multiplierFor(p)).toBe(8); // capped
  });
});
