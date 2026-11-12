import { describe, expect, it } from 'vitest';
import type { GameConfig } from '@slots/math-core';
import gameJson from '../../../games/game-001/game.json';
import { createLocalGame, DebugController } from '../src/index';

const config = gameJson as unknown as GameConfig;
const make = () => { const game = createLocalGame({ config, seed: 3, debug: true }); return { game, dbg: new DebugController(game) }; };

describe('DebugController', () => {
  it('changes a number for this session and never touches the base config', () => {
    const { game, dbg } = make();
    const before = dbg.get('freeSpins');
    expect(dbg.nudge('freeSpins', 1)).toBe(true);
    expect(dbg.get('freeSpins')).toBe(before + 1);
    expect(dbg.overridesActive).toBe(true);
    expect(game.services.config.base.freeSpins.spins).toBe(before);
    dbg.clearOverrides();
    expect(dbg.get('freeSpins')).toBe(before);
    expect(dbg.overridesActive).toBe(false);
  });

  it('refuses an invalid value, says why, and keeps the old value', () => {
    const { dbg } = make();
    const before = dbg.get('goldenBase');
    expect(dbg.set('goldenBase', 5)).toBe(false); // a chance above 1
    expect(dbg.message.value.bad).toBe(true);
    expect(dbg.get('goldenBase')).toBe(before);
  });

  it('cycles the variant A, B, C, D and back, and describes each', () => {
    const { dbg } = make();
    const seen: string[] = [dbg.config.value.multiplier.variant];
    for (let i = 0; i < 4; i++) { dbg.cycleVariant(); seen.push(dbg.config.value.multiplier.variant); }
    expect(seen).toEqual(['A', 'B', 'C', 'D', 'A']);
    for (const v of ['A', 'B', 'C', 'D'] as const) { dbg.setVariant(v); expect(dbg.describeVariant()).toMatch(new RegExp(`^${v}\\.`)); }
  });

  it('the buy price belongs to the selected variant', () => {
    const { dbg } = make();
    dbg.setVariant('D');
    dbg.set('buyPrice', 70);
    expect(dbg.get('buyPrice')).toBe(70);
    dbg.setVariant('A');
    expect(dbg.get('buyPrice')).toBe(50);
  });

  it('forces free spins on the next spin only', async () => {
    const { game, dbg } = make();
    dbg.forceFreeSpins();
    const r = (await game.controllers.spin.spinOnce())!.result;
    expect(r.freeSpins).not.toBeNull();
  });

  it('sets the balance, but not while a round is running', async () => {
    const { game, dbg } = make();
    expect(dbg.setBalance(500)).toBe(true);
    expect(game.models.wallet.balance.value).toBe(500);
    const running = game.controllers.spin.spinOnce();
    expect(dbg.setBalance(900)).toBe(false);
    await running;
    expect(dbg.setBalance(-1)).toBe(false);
  });

  it('counts session stats', async () => {
    const { game, dbg } = make();
    for (let i = 0; i < 20; i++) await game.controllers.spin.spinOnce();
    expect(dbg.stats.value.rounds).toBe(20);
    expect(dbg.stats.value.cost).toBeCloseTo(200);
    expect(dbg.sessionRtp()).toBeDefined();
    dbg.resetStats();
    expect(dbg.stats.value.rounds).toBe(0);
  });
});
