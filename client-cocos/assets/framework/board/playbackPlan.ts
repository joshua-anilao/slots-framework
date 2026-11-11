import type { Grid, Pos, RoundResult, SpinOutcome } from '../../shared/math-core/index';

/** One thing the board does, in order. The view turns these into animations; the plan itself is plain data. */
export type PlaybackOp =
  | { op: 'land'; grid: Grid; multiplier: number }
  | { op: 'win'; index: number; positions: Pos[]; stepWin: number; multiplier: number }
  | { op: 'pop'; removed: Pos[]; toWild: Pos[] }
  | { op: 'drop'; grid: Grid; removed: Pos[] };

/** The script for one spin (base or one free spin): land, then for each winning step: win, pop, drop. */
export function planSpin(spin: SpinOutcome): PlaybackOp[] {
  const steps = spin.steps;
  if (!steps.length || !steps[0]!.grid) return [];
  const ops: PlaybackOp[] = [{ op: 'land', grid: steps[0]!.grid!, multiplier: steps[0]!.multiplier }];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (!step.wins.length) break;
    ops.push({ op: 'win', index: i, positions: step.wins.flatMap(w => w.positions), stepWin: step.stepWin, multiplier: step.multiplier });
    ops.push({ op: 'pop', removed: step.removed, toWild: step.toWild });
    const next = steps[i + 1];
    if (next?.grid) ops.push({ op: 'drop', grid: next.grid, removed: step.removed });
  }
  return ops;
}

/** The grid left on screen when a spin has finished playing. */
export function finalGrid(spin: SpinOutcome): Grid | undefined {
  for (let i = spin.steps.length - 1; i >= 0; i--) if (spin.steps[i]!.grid) return spin.steps[i]!.grid;
  return undefined;
}

/** Every spin of a round in play order: the base spin first, then each free spin. */
export function spinsOf(result: RoundResult): SpinOutcome[] {
  return [...(result.base ? [result.base] : []), ...(result.freeSpins?.spins ?? [])];
}
