import type { GameConfig, SymbolConfig } from './config';
import type { Grid, Pos, WaysWin } from './result';

/**
 * Finds every ways win on a grid: a symbol (or wild) on adjacent reels from the left,
 * at least `minWaysCount` reels long. Ways = product of matches per reel.
 */
export class WaysEvaluator {
  private readonly paying: SymbolConfig[];

  constructor(private readonly config: GameConfig) {
    this.paying = config.symbols.filter(s => s.kind === 'normal' && s.pays);
  }

  /** Returns all wins for this grid at the given bet (before any multiplier). */
  evaluate(grid: Grid, bet: number): WaysWin[] {
    const wins: WaysWin[] = [];
    const wild = this.config.wildSymbol;
    for (const sym of this.paying) {
      let ways = 1;
      let count = 0;
      const positions: Pos[] = [];
      for (let reel = 0; reel < grid.length; reel++) {
        let matches = 0;
        const column = grid[reel];
        for (let row = 0; row < column.length; row++) {
          const id = column[row].s;
          if (id === sym.id || id === wild) {
            matches++;
            positions.push({ reel, row });
          }
        }
        if (matches === 0) break;
        ways *= matches;
        count++;
      }
      if (count < this.config.minWaysCount) continue;
      const payPerWay = sym.pays?.[String(count)] ?? 0;
      if (payPerWay <= 0) continue;
      // Positions on reels beyond the matched run were never added (loop breaks first).
      wins.push({ symbol: sym.id, count, ways, payPerWay, baseWin: payPerWay * ways * bet, positions });
    }
    return wins;
  }
}
