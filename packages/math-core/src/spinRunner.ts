import type { GameConfig } from './config';
import type { GoldBank } from './goldBank';
import type { IMultiplierStrategy } from './multiplierStrategy';
import type { CascadeStep, Pos, SpinOutcome } from './result';
import type { IRng } from './rng';
import { ReelState } from './reelState';
import { WaysEvaluator } from './waysEvaluator';

export interface SpinOptions {
  isFree: boolean;
  bet: number;
  /** Money still payable before the max-win cap is hit. */
  capRemaining: number;
  /** Record grids per step (needed for playback, off for fast simulation). */
  fullDetail: boolean;
  forcedStops?: number[];
}

/** Plays one spin (base or free) with all its cascades. */
export class SpinRunner {
  private readonly evaluator: WaysEvaluator;

  constructor(private readonly config: GameConfig, private readonly rng: IRng) {
    this.evaluator = new WaysEvaluator(config);
  }

  run(multiplier: IMultiplierStrategy, bank: GoldBank, opts: SpinOptions): { outcome: SpinOutcome; capped: boolean } {
    const c = this.config;
    const strips = opts.isFree ? c.reelSets.free : c.reelSets.base;
    const chance = opts.isFree ? c.golden.chanceFree : c.golden.chanceBase;
    const gb = c.goldBank;
    const badge = bank.enabled && gb
      ? { chance: opts.isFree ? gb.badgeChanceFree : gb.badgeChanceBase, values: opts.isFree ? gb.valuesFree : gb.valuesBase }
      : undefined;
    const reels = new ReelState(c, strips, this.rng, chance, opts.forcedStops, badge);
    multiplier.startSpin(opts.isFree);
    bank.startSpin(opts.isFree);

    const steps: CascadeStep[] = [];
    let spinWin = 0;
    let cascades = 0;
    let capRemaining = opts.capRemaining;
    let capped = false;

    for (let guard = 0; guard <= c.maxCascades; guard++) {
      const grid = opts.fullDetail ? reels.snapshot() : undefined;
      const wins = this.evaluator.evaluate(reels.grid, opts.bet);
      if (wins.length === 0) {
        const last: CascadeStep = { grid, wins, multiplier: multiplier.current() + bank.value, stepWin: 0, removed: [], toWild: [], spots: multiplier.spots() };
        if (bank.enabled) { last.bank = bank.value; last.banked = []; }
        steps.push(last);
        break;
      }
      const all: Pos[] = [];
      for (const w of wins) for (const p of w.positions) all.push(p);
      const bankBefore = bank.value;
      const mult = multiplier.multiplierFor(all) + bankBefore;
      let stepWin = wins.reduce((a, w) => a + w.baseWin, 0) * mult;
      if (stepWin >= capRemaining) { stepWin = capRemaining; capped = true; }
      capRemaining -= stepWin;
      spinWin += stepWin;

      const { removed, toWild, removeMask, banked } = this.resolveWins(reels, all);
      multiplier.afterWin(all);
      const step: CascadeStep = { grid, wins, multiplier: mult, stepWin, removed, toWild, spots: multiplier.spots() };
      if (bank.enabled) {
        for (const b of banked) bank.add(b.value);
        step.bank = bankBefore;
        step.banked = banked;
      }
      steps.push(step);
      if (capped) break;
      reels.collapse(removeMask);
      cascades++;
    }

    const scatterCount = c.freeSpins.enabled ? countSymbol(reels.grid, c.freeSpins.scatterSymbol) : 0;
    const outcome: SpinOutcome = {
      stops: reels.stops,
      steps,
      cascades,
      spinWin,
      scatterCount,
      freeSpinsAwarded: capped ? 0 : this.freeSpinsFor(scatterCount),
    };
    return { outcome, capped };
  }

  /** Free spins earned for this many scatters (0 if not enough). */
  freeSpinsFor(scatters: number): number {
    const fs = this.config.freeSpins;
    if (!fs.enabled || scatters < fs.minScatters) return 0;
    return fs.spins + fs.extraPerScatter * (scatters - fs.minScatters);
  }

  /** Golden winners turn into wilds; other winners (and used wilds, if configured) are removed. */
  private resolveWins(reels: ReelState, all: Pos[]) {
    const c = this.config;
    const { reels: n, rows } = c.grid;
    const removeMask = Array.from({ length: n }, () => new Array<boolean>(rows).fill(false));
    const removed: Pos[] = [];
    const toWild: Pos[] = [];
    const banked: { pos: Pos; value: number }[] = [];
    const seen = new Set<number>();
    for (const p of all) {
      const key = p.reel * 1000 + p.row;
      if (seen.has(key)) continue;
      seen.add(key);
      const cell = reels.grid[p.reel][p.row];
      if (cell.g) {
        cell.s = c.wildSymbol;
        cell.g = false;
        toWild.push(p);
        if (cell.b !== undefined) {
          banked.push({ pos: p, value: cell.b });
          delete cell.b;
        }
      } else if (cell.s === c.wildSymbol && !c.wildRemovedAfterWin) {
        // wild stays
      } else {
        removeMask[p.reel][p.row] = true;
        removed.push(p);
      }
    }
    return { removed, toWild, removeMask, banked };
  }
}

function countSymbol(grid: { s: string }[][], id: string): number {
  let n = 0;
  for (const col of grid) for (const cell of col) if (cell.s === id) n++;
  return n;
}

/** Rounds money to cents. The engine keeps exact values inside a round and rounds only the round total. */
export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
