import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GameConfig } from '@slots/math-core';
import { createLocalGame } from '../src';

const config = JSON.parse(readFileSync(fileURLToPath(new URL('../../../games/game-001/game.json', import.meta.url)), 'utf8')) as GameConfig;
const game = (balance: number, seed = 7) => createLocalGame({ config, balance, seed, debug: true });

describe('edge cases: balance', () => {
  it('cannot spin at zero balance and leaves everything untouched', async () => {
    const g = game(0);
    const seen: string[] = [];
    g.bus.on('insufficientFunds', () => seen.push('funds'));
    g.bus.on('spinStarted', () => seen.push('started'));
    expect(await g.controllers.spin.spinOnce()).toBeNull();
    expect(seen).toEqual(['funds']);
    expect(g.models.wallet.balance.value).toBe(0);
    expect(g.models.spin.phase.value).toBe('idle');
    expect(await g.services.history.query()).toHaveLength(0);
  });

  it('allows a spin with exactly the bet left', async () => {
    const g = game(10);
    expect(await g.controllers.spin.spinOnce()).not.toBeNull();
  });

  it('refuses a buy it cannot afford without charging', async () => {
    const g = game(499); // price at bet 10 is 500
    const needed: number[] = [];
    g.bus.on('insufficientFunds', e => needed.push(e.needed));
    expect(g.controllers.buyBonus.canAfford()).toBe(false);
    expect(await g.controllers.buyBonus.buy(1)).toEqual([]);
    expect(needed).toEqual([500]);
    expect(g.models.wallet.balance.value).toBe(499);
  });

  it('stops a multi-buy when the money runs out', async () => {
    const g = game(1200, 3);
    const bought = await g.controllers.buyBonus.buy(10);
    expect(bought.length).toBeGreaterThanOrEqual(2);
    expect(bought.length).toBeLessThan(10);
    expect(g.models.wallet.balance.value).toBeLessThan(500);
  });

  it('auto spin stops with insufficientFunds when the balance runs out', async () => {
    const g = createLocalGame({ config, balance: 30, seed: 11, debug: true });
    g.controllers.bet.select(0);
    const reason = await g.controllers.autoSpin.start(Infinity);
    expect(reason).toBe('insufficientFunds');
    expect(g.models.autoSpin.active.value).toBe(false);
    expect(g.models.wallet.balance.value).toBeLessThan(g.models.bet.bet);
  });

  it('balance always matches the history over many rounds', async () => {
    const g = game(100_000, 5);
    for (let i = 0; i < 300; i++) await g.controllers.spin.spinOnce();
    const hist = await g.services.history.query();
    const net = hist.reduce((n, h) => n + h.net, 0);
    expect(g.models.wallet.balance.value).toBeCloseTo(100_000 + net, 2);
    expect(g.models.wallet.balance.value).toBe(g.services.wallet.peek());
    expect(Math.round(g.models.wallet.balance.value * 100)).toBe(g.models.wallet.balance.value * 100);
  });
});

describe('edge cases: failures', () => {
  it('rejects a bet that is not a bet level, refunds the shown balance and charges nothing', async () => {
    const g = game(1000);
    const failed: string[] = [];
    g.bus.on('spinFailed', e => failed.push(e.message));
    (g.models.bet as unknown as { levels: number[] }).levels = [7]; // a tampered client
    g.models.bet.index.set(0);
    expect(await g.controllers.spin.spinOnce()).toBeNull();
    expect(failed[0]).toMatch(/not one of the allowed bet levels/);
    expect(g.models.wallet.balance.value).toBe(1000);
    expect(g.services.wallet.peek()).toBe(1000);
    expect(g.models.spin.phase.value).toBe('idle');
  });

  it('settles the balance and returns to idle even if the view crashes', async () => {
    const g = createLocalGame({ config, balance: 1000, seed: 1, debug: true,
      presenter: { present: async () => { throw new Error('view broke'); }, skip() {} } });
    const failed: string[] = [];
    g.bus.on('spinFailed', e => failed.push(e.message));
    const res = await g.controllers.spin.spinOnce();
    expect(res).not.toBeNull(); // the round counts: it was played and paid
    expect(failed).toEqual(['Playback failed: view broke']);
    expect(g.models.spin.phase.value).toBe('idle');
    expect(g.models.wallet.balance.value).toBe(g.services.wallet.peek());
    expect(await g.controllers.autoSpin.start(3)).toBe('finished'); // auto spin does not jam
  });

  it('ignores force options when debug is off', async () => {
    const g = createLocalGame({ config, balance: 1000, seed: 2, debug: false });
    let triggered = 0;
    for (let i = 0; i < 20; i++) {
      g.controllers.spin.forceNext({ triggerFreeSpins: true });
      const r = await g.controllers.spin.spinOnce().catch(() => null);
      if (r?.result.freeSpins) triggered++;
    }
    expect(triggered).toBeLessThan(5);
  });

  it('rejects a broken debug override and keeps the current config', () => {
    const g = game(1000);
    const before = g.services.config.config.value;
    expect(() => g.services.config.setOverrides({ maxWinX: 0 })).toThrow();
    expect(g.services.config.config.value).toBe(before);
    expect(g.services.config.changed).toEqual([]);
  });
});
