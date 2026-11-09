import type { AutoSpinStopReason, EventBus } from '../core/eventBus';
import type { AutoSpinModel, AutoSpinStopConditions } from '../models/autoSpinModel';
import type { WalletModel } from '../models/walletModel';
import type { SpinController } from './spinController';

/** Runs spins back to back until the count runs out or a stop condition hits. */
export class AutoSpinController {
  constructor(
    private readonly spins: SpinController,
    private readonly model: AutoSpinModel,
    private readonly wallet: WalletModel,
    private readonly bus: EventBus,
  ) {}

  /** Starts auto spin. count = Infinity for "until stopped". Resolves when it stops. */
  async start(count: number, conditions?: Partial<AutoSpinStopConditions>): Promise<AutoSpinStopReason> {
    if (this.model.active.value || count <= 0) return 'player';
    this.model.conditions = { ...this.model.conditions, ...conditions };
    this.model.startBalance = this.wallet.balance.value;
    this.model.remaining.set(count);
    this.model.active.set(true);
    let reason: AutoSpinStopReason = 'finished';
    let noFunds = false;
    const offFunds = this.bus.on('insufficientFunds', () => { noFunds = true; });

    while (this.model.active.value && this.model.remaining.value > 0) {
      this.model.remaining.set(this.model.remaining.value - 1);
      const res = await this.spins.spinOnce();
      if (!res) { reason = noFunds ? 'insufficientFunds' : 'error'; break; }
      if (!this.model.active.value) { reason = 'player'; break; }
      const c = this.model.conditions;
      const r = res.result;
      if (c.onFeature && r.freeSpins) { reason = 'feature'; break; }
      if (c.singleWinAtLeast > 0 && r.totalWin >= c.singleWinAtLeast) { reason = 'bigWin'; break; }
      if (c.balanceDropBy > 0 && this.model.startBalance - this.wallet.balance.value >= c.balanceDropBy) { reason = 'balanceDrop'; break; }
    }
    offFunds();
    if (reason === 'finished' && this.model.remaining.value > 0) reason = 'player';
    this.model.active.set(false);
    this.model.remaining.set(0);
    this.bus.publish('autoSpinStopped', { reason });
    return reason;
  }

  /** Player pressed stop. The current spin finishes first. */
  stop(): void {
    this.model.active.set(false);
  }
}
