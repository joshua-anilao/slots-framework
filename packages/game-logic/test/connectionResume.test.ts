import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GameConfig } from '@slots/math-core';
import { createLocalGame } from '../src';
import type { SpinResponse } from '../src';

const config = JSON.parse(readFileSync(fileURLToPath(new URL('../../../games/game-001/game.json', import.meta.url)), 'utf8')) as GameConfig;
const game = (balance = 1000, seed = 7) => createLocalGame({ config, balance, seed, debug: true });

describe('connection', () => {
  it('a spin while offline charges nothing, records nothing and publishes connectionLost', async () => {
    const g = game();
    const lost: string[] = [];
    g.bus.on('connectionLost', e => lost.push(e.message));
    g.services.spin.setOffline(true);
    expect(await g.controllers.spin.spinOnce()).toBeNull();
    expect(lost).toEqual(['Connection lost']);
    expect(g.models.wallet.balance.value).toBe(1000);
    expect(g.services.wallet.peek()).toBe(1000);
    expect(g.models.spin.phase.value).toBe('idle');
    expect(await g.services.history.query()).toHaveLength(0);
  });

  it('spins again once back online', async () => {
    const g = game();
    g.services.spin.setOffline(true);
    await g.controllers.spin.spinOnce();
    g.services.spin.setOffline(false);
    expect(await g.controllers.spin.spinOnce()).not.toBeNull();
  });

  it('auto spin stops with "error" when the connection drops', async () => {
    const g = game();
    g.services.spin.setOffline(true);
    expect(await g.controllers.autoSpin.start(10)).toBe('error');
    expect(g.models.autoSpin.active.value).toBe(false);
  });

  it('simulated latency delays the response', async () => {
    const g = game();
    g.services.spin.setLatency(60);
    const t0 = Date.now();
    await g.controllers.spin.spinOnce();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(50);
  });
});

describe('interrupted round resume', () => {
  it('shows a settled round again without charging twice', async () => {
    const g = game();
    const res = (await g.controllers.spin.spinOnce()) as SpinResponse;
    // Next session: the server says this round was never shown.
    const g2 = game(res.balanceAfter, 99);
    const seen: number[] = [];
    let resumed = '';
    g2.bus.on('roundResumed', e => { resumed = e.roundId; });
    g2.models.wallet.balance.subscribe(v => seen.push(v));
    const out = await g2.controllers.spin.resume(res);
    expect(out).toBe(res);
    expect(resumed).toBe(res.roundId);
    // Shown balance goes to "before the win" during playback, then lands on the real balance.
    expect(seen).toContain(Math.round((res.balanceBefore - res.result.cost) * 100) / 100);
    expect(g2.models.wallet.balance.value).toBe(res.balanceAfter);
    expect(g2.services.wallet.peek()).toBe(res.balanceAfter);
    expect(g2.models.spin.lastWin.value).toBe(res.result.totalWin);
    expect(g2.models.spin.phase.value).toBe('idle');
    expect(await g2.services.history.query()).toHaveLength(0);
  });

  it('refuses to resume while another round is playing', async () => {
    const g = game();
    const res = (await g.controllers.spin.spinOnce()) as SpinResponse;
    g.models.spin.phase.set('presenting');
    expect(await g.controllers.spin.resume(res)).toBeNull();
  });
});
