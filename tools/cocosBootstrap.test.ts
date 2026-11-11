import { describe, expect, it } from 'vitest';
import { createLocalGame } from '../packages/game-logic/src/index';
import type { GameConfig } from '../packages/math-core/src/index';
import gameJson from '../games/game-001/game.json';
import { createCocosGame } from '../client-cocos/assets/framework/bootstrap/createCocosGame';
import { gameConfig } from '../client-cocos/assets/game/generated/gameConfig';

const spins = async (game: { controllers: { spin: { spinOnce(): Promise<unknown> } }; models: { wallet: { balance: { value: number } } } }, n: number) => {
  const wins: unknown[] = [];
  for (let i = 0; i < n; i++) {
    // roundId and timestamp come from the clock, so they are left out of the comparison.
    const { roundId: _id, timestamp: _t, ...rest } = (await game.controllers.spin.spinOnce()) as Record<string, unknown>;
    wins.push(rest);
  }
  return { wins, balance: game.models.wallet.balance.value };
};

describe('Cocos bootstrap', () => {
  it('generated config equals game.json', () => {
    expect(gameConfig).toEqual(gameJson);
  });

  it('plays the same rounds as the shared game for the same seed', async () => {
    const proto = createLocalGame({ config: gameJson as unknown as GameConfig, seed: 42 });
    const cocos = createCocosGame({ config: gameConfig, seed: 42 });
    const a = await spins(proto, 200);
    const b = await spins(cocos, 200);
    expect(b).toEqual(a);
    expect(a.balance).not.toBe(10_000);
  });

  it('a different seed plays different rounds', async () => {
    const a = await spins(createCocosGame({ config: gameConfig, seed: 1 }), 50);
    const b = await spins(createCocosGame({ config: gameConfig, seed: 2 }), 50);
    expect(b).not.toEqual(a);
  });
});
