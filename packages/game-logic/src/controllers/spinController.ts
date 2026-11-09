import type { EventBus } from '../core/eventBus';
import type { BetModel } from '../models/betModel';
import type { SpeedModel } from '../models/speedModel';
import type { SpinModel } from '../models/spinModel';
import type { WalletModel } from '../models/walletModel';
import { winTierFor } from '../models/winTiers';
import type { WinTierThresholds } from '../models/winTiers';
import type { IRoundPresenter } from './roundPresenter';
import { InsufficientFundsError } from '../services/spinService';
import type { ISpinService, SpinRequest, SpinResponse } from '../services/spinService';
import type { ForceOptions } from '@slots/math-core';

/**
 * The spin flow: idle → requesting → presenting → idle.
 * Takes the bet off the shown balance at once, asks the spin service,
 * lets the view play the result, then shows the final balance.
 */
export class SpinController {
  /** Debug: force options for the next spin only. */
  private nextForce: ForceOptions | undefined;

  constructor(
    private readonly service: ISpinService,
    private readonly presenter: IRoundPresenter,
    private readonly wallet: WalletModel,
    private readonly bet: BetModel,
    private readonly spin: SpinModel,
    private readonly speed: SpeedModel,
    private readonly bus: EventBus,
    private readonly tiers: WinTierThresholds,
    private readonly buyPriceX: () => number,
  ) {}

  /** Debug panel: force the next round (dev builds only; the service ignores it otherwise). */
  forceNext(force: ForceOptions): void { this.nextForce = force; }

  /** Plays one normal round. Returns the response, or null if it could not start. */
  async spinOnce(): Promise<SpinResponse | null> {
    return this.run({ bet: this.bet.bet });
  }

  /** Buys free spins at the current bet. */
  async buyBonus(): Promise<SpinResponse | null> {
    return this.run({ bet: this.bet.bet, buyBonus: true });
  }

  /** Player tapped during playback: skip to the end. */
  skip(): void {
    if (this.spin.phase.value === 'presenting') this.presenter.skip();
  }

  private async run(req: SpinRequest): Promise<SpinResponse | null> {
    if (this.spin.isBusy) return null;
    const cost = req.buyBonus ? Math.round(this.buyPriceX() * req.bet * 100) / 100 : req.bet;
    const shown = this.wallet.balance.value;
    if (shown < cost) {
      this.bus.publish('insufficientFunds', { needed: cost, balance: shown });
      return null;
    }
    if (this.nextForce) { req.force = this.nextForce; this.nextForce = undefined; }

    this.spin.phase.set('requesting');
    this.spin.lastWin.set(0);
    this.wallet.balance.set(Math.round((shown - cost) * 100) / 100);
    this.bus.publish('spinStarted', { bet: req.bet, buyBonus: !!req.buyBonus });

    let response: SpinResponse;
    try {
      response = await this.service.spin(req);
    } catch (err) {
      this.wallet.balance.set(shown);
      this.spin.phase.set('idle');
      if (err instanceof InsufficientFundsError) {
        this.bus.publish('insufficientFunds', { needed: err.needed, balance: err.balance });
      } else {
        this.bus.publish('spinFailed', { message: err instanceof Error ? err.message : String(err) });
      }
      return null;
    }

    const r = response.result;
    this.spin.lastRoundId.set(response.roundId);
    this.bus.publish('spinResolved', { roundId: response.roundId, result: r, balanceAfter: response.balanceAfter });
    if (r.freeSpins) this.bus.publish('freeSpinsTriggered', { spins: r.freeSpins.awarded });

    this.spin.phase.set('presenting');
    try {
      await this.presenter.present(response, this.speed.mode.value);
    } finally {
      this.spin.lastWin.set(r.totalWin);
      this.wallet.balance.set(response.balanceAfter);
      const tier = winTierFor(r.winX, this.tiers);
      if (tier !== 'none') this.bus.publish('winTier', { tier, winX: r.winX, amount: r.totalWin });
      this.bus.publish('roundPresented', { roundId: response.roundId, totalWin: r.totalWin });
      this.spin.phase.set('idle');
    }
    return response;
  }
}
