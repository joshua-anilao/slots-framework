import { round2, SeededRng, SlotEngine } from '@slots/math-core';
import type { GameConfig, IRng } from '@slots/math-core';
import type { IConfigService } from './configService';
import type { LocalHistoryService } from './historyService';
import { ConnectionError, InsufficientFundsError } from './spinService';
import type { ISpinService, SpinRequest, SpinResponse } from './spinService';
import type { LocalWallet } from './walletService';

export interface LocalSpinOptions {
  /** Allow debug force options (dev builds only). */
  allowForce: boolean;
  /** Fixed seed for replayable sessions; random when omitted. */
  seed?: number;
  /** Simulated network delay in ms. */
  latencyMs?: number;
  now?: () => number;
}

/**
 * Runs math-core in the client, acting like a game server:
 * takes the cost from the wallet, plays the round, pays the win, records history.
 */
export class LocalSpinService implements ISpinService {
  private engine: SlotEngine;
  private engineConfig: GameConfig;
  private readonly rng: IRng;
  private counter = 0;
  private readonly now: () => number;
  /** Simulated network (prototype debug panel). Server builds measure the real thing. */
  private latencyMs: number;
  private offline = false;

  constructor(
    private readonly configs: IConfigService,
    private readonly wallet: LocalWallet,
    private readonly history: LocalHistoryService,
    private readonly opts: LocalSpinOptions,
  ) {
    this.rng = new SeededRng(opts.seed ?? SeededRng.randomSeed());
    this.engineConfig = configs.config.value;
    this.engine = new SlotEngine(this.engineConfig, this.rng);
    this.now = opts.now ?? Date.now;
    this.latencyMs = opts.latencyMs ?? 0;
  }

  /** Debug: simulated round trip in ms. */
  setLatency(ms: number): void { this.latencyMs = Math.max(0, ms); }
  get latency(): number { return this.latencyMs; }
  /** Debug: simulate a lost connection. Spins fail with ConnectionError and nothing is charged. */
  setOffline(v: boolean): void { this.offline = v; }

  async spin(req: SpinRequest): Promise<SpinResponse> {
    if (this.latencyMs) await new Promise(r => setTimeout(r, this.latencyMs));
    if (this.offline) throw new ConnectionError();
    const config = this.configs.config.value;
    if (config !== this.engineConfig) {
      // Debug overrides changed: rebuild the engine on the same RNG stream.
      this.engineConfig = config;
      this.engine = new SlotEngine(config, this.rng);
    }
    if (!config.bet.levels.includes(req.bet)) throw new Error(`Bet ${req.bet} is not one of the allowed bet levels`);
    const cost = req.buyBonus ? round2(config.buyBonus.priceX * req.bet) : req.bet;
    const before = this.wallet.peek();
    if (before < cost) throw new InsufficientFundsError(cost, before);

    const result = this.engine.playRound({
      bet: req.bet,
      buyBonus: req.buyBonus,
      force: this.opts.allowForce ? req.force : undefined,
    });
    this.wallet.apply(-result.cost);
    const after = this.wallet.apply(result.totalWin);
    const timestamp = this.now();
    const roundId = this.nextRoundId(timestamp);
    this.history.record({
      roundId, timestamp, bet: req.bet, cost: result.cost, win: result.totalWin,
      net: round2(result.totalWin - result.cost), buyBonus: result.buyBonus,
      freeSpins: result.freeSpins?.spins.length ?? 0, balanceAfter: after,
    }, result);
    return { roundId, result, balanceBefore: before, balanceAfter: after, timestamp };
  }

  private nextRoundId(ts: number): string {
    this.counter++;
    return `${ts}${String(this.counter).padStart(6, '0')}`;
  }
}
