import { buyPriceX, SeededRng } from '@slots/math-core';
import type { GameConfig } from '@slots/math-core';
import { EventBus } from './core/eventBus';
import { AutoSpinController } from './controllers/autoSpinController';
import { BetController } from './controllers/betController';
import { BuyBonusController } from './controllers/buyBonusController';
import { InstantPresenter } from './controllers/roundPresenter';
import type { IRoundPresenter } from './controllers/roundPresenter';
import { SpeedController } from './controllers/speedController';
import { SpinController } from './controllers/spinController';
import { AutoSpinModel } from './models/autoSpinModel';
import { BetModel } from './models/betModel';
import { ConnectionModel } from './models/connectionModel';
import { SpeedModel } from './models/speedModel';
import { SpinModel } from './models/spinModel';
import { WalletModel } from './models/walletModel';
import { DEFAULT_WIN_TIERS } from './models/winTiers';
import type { WinTierThresholds } from './models/winTiers';
import { LocalConfigService } from './services/configService';
import { LocalHistoryService } from './services/historyService';
import { LocalSpinService } from './services/localSpinService';
import { SimulatedWinFeedService } from './services/winFeedService';
import { LocalWallet } from './services/walletService';

export interface LocalGameOptions {
  config: GameConfig;
  /** Demo starting balance. */
  balance?: number;
  /** The view's round player. Defaults to an instant (headless) presenter. */
  presenter?: IRoundPresenter;
  winTiers?: WinTierThresholds;
  /** Enables debug force options. Never true in release builds. */
  debug?: boolean;
  seed?: number;
  latencyMs?: number;
}

/**
 * Composition root: wires models, controllers and LOCAL services together.
 * For a real server, write createRemoteGame with remote services; views don't change.
 */
export function createLocalGame(opts: LocalGameOptions) {
  const bus = new EventBus();
  const configService = new LocalConfigService(opts.config);
  const wallet = new LocalWallet(opts.balance ?? 10_000);
  const history = new LocalHistoryService();
  const spinService = new LocalSpinService(configService, wallet, history, {
    allowForce: !!opts.debug, seed: opts.seed, latencyMs: opts.latencyMs,
  });
  const winFeed = new SimulatedWinFeedService(new SeededRng(SeededRng.randomSeed()), opts.config.bet.levels);

  const models = {
    wallet: new WalletModel(wallet.peek()),
    bet: new BetModel(opts.config.bet.levels, opts.config.bet.defaultIndex),
    spin: new SpinModel(),
    autoSpin: new AutoSpinModel(),
    connection: new ConnectionModel(),
    speed: new SpeedModel(),
  };

  const presenter = opts.presenter ?? new InstantPresenter();
  const priceX = () => buyPriceX(configService.config.value);
  const spin = new SpinController(spinService, presenter, models.wallet, models.bet, models.spin, models.speed,
    bus, opts.winTiers ?? DEFAULT_WIN_TIERS, priceX);
  const controllers = {
    spin,
    autoSpin: new AutoSpinController(spin, models.autoSpin, models.wallet, bus),
    bet: new BetController(models.bet, models.spin, bus),
    speed: new SpeedController(models.speed),
    buyBonus: new BuyBonusController(spin, models.bet, models.wallet, priceX),
  };

  configService.config.subscribe(() => {
    bus.publish('debugOverridesChanged', { active: configService.changed.length > 0, changed: configService.changed });
  });

  return {
    bus,
    models,
    controllers,
    services: { config: configService, wallet, history, spin: spinService, winFeed },
  };
}

export type LocalGame = ReturnType<typeof createLocalGame>;
