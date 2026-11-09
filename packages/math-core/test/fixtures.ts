import type { Cell, GameConfig, Grid } from '../src';

/** Small, readable config for tests. Strips are set per test when needed. */
export function testConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  const strip = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'SC', 'A', 'B', 'C'];
  return {
    id: 'test', name: 'Test', version: '0',
    grid: { reels: 5, rows: 4 },
    minWaysCount: 3,
    bet: { levels: [1, 10], defaultIndex: 1, currency: 'PHP' },
    symbols: [
      { id: 'A', name: 'A', kind: 'normal', canBeGolden: true, pays: { '3': 1, '4': 2, '5': 5 } },
      { id: 'B', name: 'B', kind: 'normal', canBeGolden: true, pays: { '3': 0.5, '4': 1, '5': 2 } },
      { id: 'C', name: 'C', kind: 'normal', canBeGolden: true, pays: { '3': 0.2, '4': 0.5, '5': 1 } },
      { id: 'D', name: 'D', kind: 'normal', canBeGolden: true, pays: { '3': 0.1, '4': 0.2, '5': 0.5 } },
      { id: 'W', name: 'Wild', kind: 'wild' },
      { id: 'SC', name: 'Scatter', kind: 'scatter' },
    ],
    wildSymbol: 'W',
    wildRemovedAfterWin: true,
    reelSets: { base: [strip, strip, strip, strip, strip], free: [strip, strip, strip, strip, strip] },
    golden: { enabled: true, reels: [1, 2, 3], chanceBase: 0, chanceFree: 0 },
    multiplier: {
      variant: 'A',
      A: { base: [1, 2, 3, 5], free: [2, 4, 6, 10] },
      B: { base: { start: 1, step: 1 }, free: { start: 2, step: 2 } },
      C: { base: [1, 2, 3, 5], free: [2, 4, 6, 10] },
      D: { cap: 128 },
    },
    freeSpins: { enabled: true, scatterSymbol: 'SC', minScatters: 3, spins: 10, extraPerScatter: 2, retrigger: true, maxTotalSpins: 50 },
    buyBonus: { enabled: true, priceX: 50 },
    maxWinX: 5000,
    maxCascades: 100,
    targets: { rtp: 0.965, rtpTolerance: 0.005, volatility: 'medium' },
    volatilityRating: 3,
    ...overrides,
  };
}

/** Builds a grid from rows written top to bottom, e.g. ['A B C D A', ...]. A "*" suffix marks golden. */
export function gridFromRows(rows: string[]): Grid {
  const cells = rows.map(r => r.trim().split(/\s+/));
  const reels = cells[0].length;
  const grid: Grid = [];
  for (let reel = 0; reel < reels; reel++) {
    const col: Cell[] = [];
    for (let row = 0; row < cells.length; row++) {
      const t = cells[row][reel];
      col.push({ s: t.replace('*', ''), g: t.endsWith('*') });
    }
    grid.push(col);
  }
  return grid;
}
