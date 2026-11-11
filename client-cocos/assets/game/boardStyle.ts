import type { Cell } from '../shared/math-core/index';
import type { ICardStyle } from '../framework/board/symbolView';
import type { BoardTiming } from '../framework/board/boardView';

/** Fishball Fiesta cards: cream sticker cards, gold foil for golden cards, gold tile for the wild, red for the scatter. */
export const FISHBALL_CARD_STYLE: ICardStyle = {
  background: (cell: Cell) => (cell.g ? '#d4a017' : cell.s === 'WILD' ? '#f2b705' : cell.s === 'SC' ? '#be123c' : '#fff1d0'),
  frameName: (cell: Cell) => `sym_${cell.s}`,
};

/** Normal-speed feel, matching the prototype's pacing (card drop about 1 s, cascade step about 2.5 s). */
export const NORMAL_TIMING: BoardTiming = { reelStagger: 0.08, fall: 0.45, highlight: 0.9, pop: 0.25, stepPause: 0.25 };

export const BOARD_GAP = 8;
export const BOARD_MAX_WIDTH = 680;
