import type { Cell } from '../shared/math-core/index';
import type { CardLook, ICardStyle } from '../framework/board/symbolView';

/** Colour stripe per symbol, taken from the HTML prototype. */
const ACCENT: Record<string, string> = {
  H1: '#c2410c', H2: '#7b2cbf', H3: '#ea580c', H4: '#9f1239',
  L1: '#b45309', L2: '#d97706', L3: '#ca8a04', L4: '#65a30d',
};

/** Fishball Fiesta cards: cream sticker cards with a colour stripe, gold foil for golden cards, gold wild, red scatter. */
export const FISHBALL_CARD_STYLE: ICardStyle = {
  look(cell: Cell): CardLook {
    if (cell.s === 'WILD') return { fill: '#f2b705', ring: '#fff3b0', glyph: 'WILD', glyphColor: '#3b2300', artScale: 0.72, gold: false };
    if (cell.s === 'SC') return { fill: '#be123c', ring: '#ffd0da', glyph: 'SCATTER', glyphColor: '#fff1f2', artScale: 0.72, gold: false };
    return { fill: cell.g ? '#d4a017' : '#fff1d0', accent: ACCENT[cell.s] ?? '#555555', artScale: 0.88, gold: !!cell.g };
  },
  frameName: (cell: Cell) => `sym_${cell.s}`,
};
