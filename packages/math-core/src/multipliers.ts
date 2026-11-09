import type { GameConfig } from './config';
import type { Pos } from './result';
import type { IMultiplierStrategy } from './multiplierStrategy';

const step = (ladder: number[], i: number) => ladder[Math.min(i, ladder.length - 1)];

/** Variant A: fixed ladder, resets every spin (e.g. x1 x2 x3 x5, free spins x2 x4 x6 x10). */
export class LadderMultiplier implements IMultiplierStrategy {
  protected index = 0;
  protected isFree = false;
  constructor(protected readonly base: number[], protected readonly free: number[]) {}
  startFeature(): void { this.index = 0; }
  startSpin(isFree: boolean): void { this.isFree = isFree; this.index = 0; }
  multiplierFor(): number { return this.current(); }
  current(): number { return step(this.isFree ? this.free : this.base, this.index); }
  afterWin(): void { this.index++; }
  spots(): undefined { return undefined; }
}

/** Variant C: like A, but in free spins the ladder keeps climbing across spins. */
export class PersistentLadderMultiplier extends LadderMultiplier {
  override startSpin(isFree: boolean): void {
    this.isFree = isFree;
    if (!isFree) this.index = 0;
  }
}

/** Variant B: endless, start + step per cascade, resets every spin. */
export class EndlessMultiplier implements IMultiplierStrategy {
  private index = 0;
  private isFree = false;
  constructor(private readonly config: GameConfig['multiplier']['B']) {}
  startFeature(): void { this.index = 0; }
  startSpin(isFree: boolean): void { this.isFree = isFree; this.index = 0; }
  multiplierFor(): number { return this.current(); }
  current(): number {
    const c = this.isFree ? this.config.free : this.config.base;
    return c.start + c.step * this.index;
  }
  afterWin(): void { this.index++; }
  spots(): undefined { return undefined; }
}

/**
 * Variant D: multiplier spots. A cell that is part of a win is marked;
 * each later win on a marked cell doubles it (x2, x4, x8 ... up to cap).
 * A step's multiplier is the sum of active spots (x2+) under its wins, at least x1.
 * Spots reset every base spin and last for the whole free spins feature.
 */
export class SpotsMultiplier implements IMultiplierStrategy {
  private grid: number[][];
  private isFree = false;
  constructor(private readonly reels: number, private readonly rows: number, private readonly cap: number) {
    this.grid = this.empty();
  }
  startFeature(): void { this.grid = this.empty(); }
  startSpin(isFree: boolean): void {
    this.isFree = isFree;
    if (!isFree) this.grid = this.empty();
  }
  multiplierFor(winPositions: Pos[]): number {
    let sum = 0;
    for (const p of unique(winPositions)) {
      const v = this.grid[p.reel][p.row];
      if (v >= 2) sum += v;
    }
    return Math.max(1, sum);
  }
  current(): number { return 1; }
  afterWin(winPositions: Pos[]): void {
    for (const p of unique(winPositions)) {
      const v = this.grid[p.reel][p.row];
      this.grid[p.reel][p.row] = v === 0 ? 1 : Math.min(v * 2, this.cap);
    }
  }
  spots(): number[][] { return this.grid.map(c => c.slice()); }
  private empty(): number[][] {
    return Array.from({ length: this.reels }, () => new Array<number>(this.rows).fill(0));
  }
}

/** Builds the strategy for the configured variant. */
export function createMultiplier(config: GameConfig): IMultiplierStrategy {
  const m = config.multiplier;
  switch (m.variant) {
    case 'A': return new LadderMultiplier(m.A.base, m.A.free);
    case 'B': return new EndlessMultiplier(m.B);
    case 'C': return new PersistentLadderMultiplier(m.C.base, m.C.free);
    case 'D': return new SpotsMultiplier(config.grid.reels, config.grid.rows, m.D.cap);
    default: throw new Error(`Unknown multiplier variant: ${String(m.variant)}`);
  }
}

function unique(positions: Pos[]): Pos[] {
  const seen = new Set<number>();
  const out: Pos[] = [];
  for (const p of positions) {
    const k = p.reel * 1000 + p.row;
    if (!seen.has(k)) { seen.add(k); out.push(p); }
  }
  return out;
}
