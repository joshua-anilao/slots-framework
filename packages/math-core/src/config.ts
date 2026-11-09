/**
 * Game configuration types. A game's whole math lives in one `game.json`
 * that matches {@link GameConfig}. Nothing here is engine specific.
 */

/** What a symbol does on the reels. */
export type SymbolKind = 'normal' | 'wild' | 'scatter';

/** One symbol and its pays. */
export interface SymbolConfig {
  /** Short id used on reel strips, e.g. "H1", "L3", "WILD", "SC". */
  id: string;
  /** Display name for reports and the rules screen. */
  name: string;
  kind: SymbolKind;
  /**
   * Pays as a multiple of the TOTAL bet, per way, keyed by how many reels in a row
   * matched (3, 4, 5). Example: { "3": 0.1, "4": 0.3, "5": 0.8 }.
   */
  pays?: Record<string, number>;
  /** True if this symbol can land golden on golden reels (golden symbols turn into wilds when they win). */
  canBeGolden?: boolean;
}

/** Reel strips: one array of symbol ids per reel. */
export interface ReelSetConfig {
  base: string[][];
  free: string[][];
}

/** Golden symbols that turn into wilds when part of a win. */
export interface GoldenConfig {
  enabled: boolean;
  /** 0-based reel indexes that can show golden symbols (e.g. [1, 2, 3] = reels 2 to 4). */
  reels: number[];
  /** Chance (0 to 1) that an eligible symbol lands golden, in the base game. */
  chanceBase: number;
  /** Same, during free spins. */
  chanceFree: number;
}

/** Fixed ladder steps, e.g. [1, 2, 3, 5]. The last step repeats. */
export interface LadderConfig {
  base: number[];
  free: number[];
}

/** Endless multiplier: start, then + step per cascade. */
export interface EndlessConfig {
  base: { start: number; step: number };
  free: { start: number; step: number };
}

/**
 * Cascading multiplier variants (see docs/SCREENS_AND_FEATURES.md section 6).
 * A = fixed ladder, B = endless +step, C = ladder that persists through free spins,
 * D = multiplier spots on cells.
 */
export type MultiplierVariant = 'A' | 'B' | 'C' | 'D';

export interface MultiplierConfig {
  variant: MultiplierVariant;
  A: LadderConfig;
  B: EndlessConfig;
  C: LadderConfig;
  D: { cap: number };
}

export interface FreeSpinsConfig {
  enabled: boolean;
  /** Symbol id of the scatter. */
  scatterSymbol: string;
  /** Scatters needed anywhere on the final grid to trigger. */
  minScatters: number;
  /** Free spins for the minimum scatters. */
  spins: number;
  /** Extra spins per scatter above the minimum. */
  extraPerScatter: number;
  /** Can free spins be won again during free spins. */
  retrigger: boolean;
  /** Hard limit on total free spins in one feature (safety). */
  maxTotalSpins: number;
}

export interface BuyBonusConfig {
  enabled: boolean;
  /** Price as a multiple of the bet. */
  priceX: number;
}

export interface BetConfig {
  /** Bet values the player can pick, in currency units. */
  levels: number[];
  /** Index into levels used at start. */
  defaultIndex: number;
  currency: string;
}

/** Targets the simulator checks against. Not used by the engine itself. */
export interface MathTargets {
  rtp: number;
  rtpTolerance: number;
  volatility: 'low' | 'medium' | 'medium-high' | 'high' | 'very-high';
  hitFrequency?: [number, number];
  freeSpinsOneIn?: [number, number];
}

export interface GameConfig {
  id: string;
  name: string;
  version: string;
  grid: { reels: number; rows: number };
  /** Minimum reels in a row for a ways win. */
  minWaysCount: number;
  bet: BetConfig;
  symbols: SymbolConfig[];
  wildSymbol: string;
  /** Do wilds that took part in a win get removed in the cascade. */
  wildRemovedAfterWin: boolean;
  reelSets: ReelSetConfig;
  golden: GoldenConfig;
  multiplier: MultiplierConfig;
  freeSpins: FreeSpinsConfig;
  buyBonus: BuyBonusConfig;
  /** Max win per round as a multiple of the bet. The engine stops paying at this cap. */
  maxWinX: number;
  /** Safety limit on cascades per spin. */
  maxCascades: number;
  targets: MathTargets;
  /** Volatility shown on the loading screen, 1 to 5. */
  volatilityRating: number;
}
