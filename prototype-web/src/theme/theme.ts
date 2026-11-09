import type { Cell } from '@slots/math-core';

/**
 * A theme turns frame names into visuals. Frame names are the contract from the art guide
 * (sym_H1, sym_H1_gold, ...). A re-skin is a new Theme with the same names.
 */
export interface Theme {
  readonly id: string;
  /** Builds the visual for one symbol cell. */
  symbol(cell: Cell): HTMLElement;
  /** A random-looking symbol for the blurred spin strip. */
  blurSymbol(id: string): HTMLElement;
  /** Card back (frame "sym_back"): shown while a gold card turns into a WILD. */
  cardBack(): HTMLElement;
}

export const frameName = (cell: Cell): string => `sym_${cell.s}${cell.g ? '_gold' : ''}`;
