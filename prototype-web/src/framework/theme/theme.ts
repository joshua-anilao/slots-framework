import type { Cell } from '@slots/math-core';
import type { CharacterConfig } from '../character/characterReactions';
import type { CharacterSpec } from '../character/characterRig';

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
  /** Image shown outside the game on wide screens (art frame bg_desktop). None = CSS placeholder. */
  readonly backdrop?: string;
  /** The character on the stage at the top (feature 22). None = an empty scene. */
  readonly character?: CharacterSpec;
  /** Optional overrides for the character timings and reactions. */
  readonly characterConfig?: Partial<CharacterConfig>;
}

export const frameName = (cell: Cell): string => `sym_${cell.s}${cell.g ? '_gold' : ''}`;
