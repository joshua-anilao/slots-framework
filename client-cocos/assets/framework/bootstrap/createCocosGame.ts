import { createLocalGame } from '../../shared/game-logic/index';
import type { IRoundPresenter, LocalGame } from '../../shared/game-logic/index';
import type { GameConfig } from '../../shared/math-core/index';

export interface CocosGameOptions {
  config: GameConfig;
  /** Plays a round on screen. Leave out for a headless game (tests, simulations). */
  presenter?: IRoundPresenter;
  balance?: number;
  /** Same seed gives the same rounds as the browser prototype. */
  seed?: number;
  /** Turns on the debug force options. Never true in a release build. */
  debug?: boolean;
}

/**
 * Cocos composition root. It reuses the shared createLocalGame, so models, controllers and math are the same
 * code as the prototype. Only the views and the presenter are Cocos specific.
 * For a real server, swap in a createRemoteGame that returns the same shape.
 */
export function createCocosGame(opts: CocosGameOptions): LocalGame {
  return createLocalGame({ config: opts.config, presenter: opts.presenter, balance: opts.balance, seed: opts.seed, debug: opts.debug });
}
