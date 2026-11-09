import type { Pos } from './result';

/**
 * Decides the cascading multiplier. One instance lives for a whole round,
 * so variants that carry over between free spins can keep state.
 */
export interface IMultiplierStrategy {
  /** Called when free spins start (after a trigger or a buy). */
  startFeature(): void;
  /** Called before each spin. */
  startSpin(isFree: boolean): void;
  /** Multiplier for a step whose wins cover these cells. */
  multiplierFor(winPositions: Pos[]): number;
  /** Multiplier shown when a step has no win (for the UI). */
  current(): number;
  /** Called after a winning step, before the cascade. */
  afterWin(winPositions: Pos[]): void;
  /** Spot values for variant D (empty for other variants). */
  spots(): number[][] | undefined;
}
