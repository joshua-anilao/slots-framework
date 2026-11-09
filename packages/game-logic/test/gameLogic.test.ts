import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GameConfig } from '@slots/math-core';
import { SeededRng } from '@slots/math-core';
import { createLocalGame, SimulatedWinFeedService, winTierFor } from '../src';
import type { IRoundPresenter, SpinResponse } from '../src';

const config = JSON.parse(readFileSync(fileURLToPath(new URL('../../../games/game-001/game.json', import.meta.url)), 'utf8')) as GameConfig;

function game(balance = 1000, presenter?: IRoundPresenter) {
  return createLocalGame({ config, balance, seed: 42, debug: true, presenter });
}

describe('spin flow', () => {
  it('takes the bet, pays the win and records history', async () => {
    const g = game();
    const bet = g.models.bet.bet;
    const res = (await g.controllers.spin.spinOnce())!;
    expect(res).not.toBeNull();
    expect(g.models.wallet.balance.value).toBeCloseTo(1000 - bet + res.result.totalWin, 2);
    expect(g.models.spin.phase.value).toBe('idle');
    const hist = await g.services.history.query();
    expect(hist).toHaveLength(1);
    expect(hist[0].roundId).toBe(res.roundId);
  });

  it('shows the balance minus the bet while the round plays', async () => {
    let seen = -1;
    const g = game(1000, { present: async () => { seen = g.models.wallet.balance.value; }, skip() {} });
    await g.controllers.spin.spinOnce();
    expect(seen).toBe(1000 - g.models.bet.bet);
  });

  it('refuses to spin without enough balance', async () => {
    const g = game(5);
    const events: number[] = [];
    g.bus.on('insufficientFunds', e => events.push(e.needed));
    expect(await g.controllers.spin.spinOnce()).toBeNull();
    expect(events).toEqual([10]);
    expect(g.models.wallet.balance.value).toBe(5);
  });

  it('ignores a second spin while one is running', async () => {
    let release!: () => void;
    const g = game(1000, { present: () => new Promise<void>(r => { release = r; }), skip() {} });
    const first = g.controllers.spin.spinOnce();
    await new Promise(r => setTimeout(r, 0));
    expect(await g.controllers.spin.spinOnce()).toBeNull();
    release();
    expect(await first).not.toBeNull();
  });

  it('blocks bet changes during a round', async () => {
    let release!: () => void;
    const g = game(1000, { present: () => new Promise<void>(r => { release = r; }), skip() {} });
    const p = g.controllers.spin.spinOnce();
    await new Promise(r => setTimeout(r, 0));
    expect(g.controllers.bet.increase()).toBe(false);
    release(); await p;
    expect(g.controllers.bet.increase()).toBe(true);
  });
});

describe('auto spin', () => {
  it('plays the requested count', async () => {
    const g = createLocalGame({ config, balance: 100_000, seed: 1, debug: true });
    const reason = await g.controllers.autoSpin.start(20, { onFeature: false });
    expect(reason).toBe('finished');
    expect(await g.services.history.query()).toHaveLength(20);
  });

  it('stops when free spins trigger', async () => {
    const g = createLocalGame({ config, balance: 100_000, seed: 1, debug: true });
    g.controllers.spin.forceNext({ triggerFreeSpins: true });
    const reason = await g.controllers.autoSpin.start(50, { onFeature: true });
    expect(reason).toBe('feature');
    expect(await g.services.history.query()).toHaveLength(1);
  });

  it('stops when the balance drops by the limit', async () => {
    const g = createLocalGame({ config, balance: 100_000, seed: 3, debug: true });
    const reason = await g.controllers.autoSpin.start(Infinity, { onFeature: false, balanceDropBy: 100 });
    expect(reason).toBe('balanceDrop');
    expect(100_000 - g.models.wallet.balance.value).toBeGreaterThanOrEqual(100);
  });
});

describe('buy bonus', () => {
  it('prices at priceX times the bet and plays free spins', async () => {
    const g = game(10_000);
    expect(g.controllers.buyBonus.price(10)).toBe(config.buyBonus.priceX * 10);
    const [r] = await g.controllers.buyBonus.buy(1);
    expect(r.result.buyBonus).toBe(true);
    expect(r.result.freeSpins).not.toBeNull();
  });
});

describe('debug overrides', () => {
  it('change the session only and can be cleared', async () => {
    const g = game();
    const events: boolean[] = [];
    g.bus.on('debugOverridesChanged', e => events.push(e.active));
    g.services.config.setOverrides({ multiplier: { variant: 'B' } });
    expect(g.services.config.config.value.multiplier.variant).toBe('B');
    expect(config.multiplier.variant).toBe('A');
    const r = (await g.controllers.spin.spinOnce())!;
    expect(r.result.variant).toBe('B');
    g.services.config.clearOverrides();
    expect(g.services.config.config.value.multiplier.variant).toBe('A');
    expect(events).toEqual([true, false]);
  });
});

describe('helpers', () => {
  it('picks win tiers', () => {
    expect(winTierFor(5)).toBe('none');
    expect(winTierFor(10)).toBe('big');
    expect(winTierFor(30)).toBe('super');
    expect(winTierFor(80)).toBe('ultra');
  });

  it('marks every simulated winner as simulated', () => {
    const feed = new SimulatedWinFeedService(new SeededRng(1), [1, 10]);
    for (let i = 0; i < 20; i++) {
      const item = feed.next();
      expect(item.simulated).toBe(true);
      expect(item.name).toMatch(/^[A-Z]{3}\*{4}$/);
    }
  });

  it('filters history by round id', async () => {
    const g = game();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push(((await g.controllers.spin.spinOnce()) as SpinResponse).roundId);
    const found = await g.services.history.query({ roundId: ids[1].slice(-6) });
    expect(found.map(f => f.roundId)).toEqual([ids[1]]);
  });
});
