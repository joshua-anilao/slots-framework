import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GameConfig } from '../src';
import { SeededRng, SlotEngine } from '../src';

const gamePath = fileURLToPath(new URL('../../../games/game-001/game.json', import.meta.url));

describe('Game 001 math', () => {
  it('lands near its RTP target (quick band check, 300k rounds)', () => {
    const c = JSON.parse(readFileSync(gamePath, 'utf8')) as GameConfig;
    const engine = new SlotEngine(c, new SeededRng(123));
    const bet = c.bet.levels[c.bet.defaultIndex];
    let cost = 0, win = 0;
    for (let i = 0; i < 300_000; i++) {
      const r = engine.playRound({ bet, detail: 'summary' });
      cost += r.cost; win += r.totalWin;
    }
    // Wide band: 300k rounds has about ±2% noise for this volatility. The 10M-round report is the real check.
    expect(Math.abs(win / cost - c.targets.rtp)).toBeLessThan(0.035);
  });
});
