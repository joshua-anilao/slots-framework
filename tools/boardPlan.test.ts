import { describe, expect, it } from 'vitest';
import { createLocalGame } from '../packages/game-logic/src/index';
import type { GameConfig } from '../packages/math-core/src/index';
import gameJson from '../games/game-001/game.json';
import { computeLayout } from '../client-cocos/assets/framework/board/boardLayout';
import { finalGrid, planSpin, spinsOf } from '../client-cocos/assets/framework/board/playbackPlan';

describe('board layout', () => {
  it('fits the board in the width and centres it', () => {
    const l = computeLayout(5, 4, 680, 8);
    expect(l.width).toBeLessThanOrEqual(680);
    expect(l.cell(0, 0).x).toBeCloseTo(-l.cell(4, 0).x);
    expect(l.cell(0, 0).y).toBeCloseTo(-l.cell(0, 3).y);
    expect(l.cell(0, 0).y).toBeGreaterThan(l.cell(0, 1).y); // row 0 is on top
  });
});

describe('playback plan', () => {
  it('plays the engine result: land, then win, pop, drop per cascade, ending on the final grid', async () => {
    const game = createLocalGame({ config: gameJson as unknown as GameConfig, seed: 7 });
    let cascades = 0;
    for (let i = 0; i < 300; i++) {
      const r = (await game.controllers.spin.spinOnce())!.result;
      for (const spin of spinsOf(r)) {
        const plan = planSpin(spin);
        expect(plan[0]!.op).toBe('land');
        const wins = plan.filter(o => o.op === 'win').length;
        expect(plan.filter(o => o.op === 'pop').length).toBe(wins);
        cascades += wins;
        // The last drop (or the landing, when nothing won) is the grid left on screen.
        const last = [...plan].reverse().find(o => o.op === 'land' || o.op === 'drop') as { grid: unknown };
        expect(last.grid).toEqual(finalGrid(spin));
        // Winning steps add up to the spin win.
        const sum = plan.filter(o => o.op === 'win').reduce((n, o) => n + (o as { stepWin: number }).stepWin, 0);
        expect(sum).toBeCloseTo(spin.spinWin, 6);
      }
    }
    expect(cascades).toBeGreaterThan(50);
  });
});
