import type { GameConfig } from './config';
import type { FreeSpinsOutcome, RoundResult, SpinOutcome } from './result';
import type { IRng } from './rng';
import type { IMultiplierStrategy } from './multiplierStrategy';
import { createMultiplier } from './multipliers';
import { round2, SpinRunner } from './spinRunner';
import { validateConfig } from './validateConfig';

/** Test and debug controls. Never available to players in production. */
export interface ForceOptions {
  /** Exact reel stop positions for the base spin. */
  stops?: number[];
  /** Start free spins after the base spin even without scatters. */
  triggerFreeSpins?: boolean;
}

export interface RoundRequest {
  bet: number;
  /** Pay the buy bonus price and go straight to free spins. */
  buyBonus?: boolean;
  /** "full" records every grid for playback (default). "summary" is for fast simulation. */
  detail?: 'full' | 'summary';
  force?: ForceOptions;
}

/**
 * The math engine. Give it a bet, get a {@link RoundResult}.
 * Pure TypeScript: runs in Node (simulator, future server), the browser and Cocos.
 */
export class SlotEngine {
  private readonly runner: SpinRunner;

  constructor(readonly config: GameConfig, private readonly rng: IRng) {
    validateConfig(config);
    this.runner = new SpinRunner(config, rng);
  }

  /** Plays one paid round: a base spin (or a buy), then any free spins. */
  playRound(req: RoundRequest): RoundResult {
    const c = this.config;
    if (!(req.bet > 0)) throw new Error(`Bet must be positive, got ${req.bet}`);
    const buy = !!req.buyBonus;
    if (buy && !c.buyBonus.enabled) throw new Error('Buy bonus is not enabled for this game');

    const fullDetail = req.detail !== 'summary';
    const multiplier = createMultiplier(c);
    const cap = c.maxWinX * req.bet;
    let total = 0;
    let capped = false;
    let base: SpinOutcome | null = null;
    let toAward = 0;

    if (buy) {
      toAward = c.freeSpins.spins;
    } else {
      const r = this.runner.run(multiplier, { isFree: false, bet: req.bet, capRemaining: cap, fullDetail, forcedStops: req.force?.stops });
      capped = r.capped;
      base = r.outcome;
      total += base.spinWin;
      toAward = base.freeSpinsAwarded;
      if (!toAward && req.force?.triggerFreeSpins && !capped) toAward = c.freeSpins.spins;
    }

    let freeSpins: FreeSpinsOutcome | null = null;
    if (toAward > 0 && !capped) {
      const fs = this.playFreeSpins(toAward, req.bet, cap - total, fullDetail, multiplier);
      freeSpins = fs.outcome;
      total += freeSpins.totalWin;
      capped = fs.capped;
    }

    total = round2(Math.min(total, cap));
    const baseWin = base ? base.spinWin : 0;
    return {
      bet: req.bet,
      cost: buy ? round2(c.buyBonus.priceX * req.bet) : req.bet,
      buyBonus: buy,
      base,
      freeSpins,
      baseWin,
      freeSpinsWin: freeSpins ? freeSpins.totalWin : 0,
      totalWin: total,
      winX: total / req.bet,
      maxWinReached: capped,
      variant: c.multiplier.variant,
    };
  }

  private playFreeSpins(initial: number, bet: number, capRemaining: number, fullDetail: boolean,
    multiplier: IMultiplierStrategy): { outcome: FreeSpinsOutcome; capped: boolean } {
    const fs = this.config.freeSpins;
    multiplier.startFeature();
    let left = initial;
    let awarded = initial;
    let retriggers = 0;
    let win = 0;
    let capped = false;
    const spins: SpinOutcome[] = [];
    while (left > 0) {
      left--;
      const r = this.runner.run(multiplier, { isFree: true, bet, capRemaining: capRemaining - win, fullDetail });
      const spin = r.outcome;
      win += spin.spinWin;
      spins.push(spin);
      if (r.capped) { capped = true; break; }
      const extra = fs.retrigger ? Math.min(spin.freeSpinsAwarded, fs.maxTotalSpins - awarded) : 0;
      spin.freeSpinsAwarded = Math.max(0, extra);
      if (extra > 0) { left += extra; awarded += extra; retriggers++; }
    }
    return { outcome: { awarded, retriggers, spins, totalWin: win }, capped };
  }
}

