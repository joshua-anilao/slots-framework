import type { Cell } from '../shared/math-core/index';
import type { CardLook, ICardStyle } from '../framework/board/symbolView';
import type { GlowSpec } from '../framework/ui/glowStyle';

/** Colour stripe per symbol, taken from the HTML prototype. */
const ACCENT: Record<string, string> = {
  H1: '#c2410c', H2: '#7b2cbf', H3: '#ea580c', H4: '#9f1239',
  L1: '#b45309', L2: '#d97706', L3: '#ca8a04', L4: '#65a30d',
};

/** Inner ring and soft outer glow of the special cards (prototype `.sym.t-wild` and `.sym.t-scatter`). */
const WILD_RING = '#fff3b0';
const WILD_GLOW: GlowSpec = { color: '#f5c542', alpha: 0.8, blur: 14 };
const SCATTER_RING = '#b5fff6';
const SCATTER_GLOW: GlowSpec = { color: '#29d3c0', alpha: 0.8, blur: 14 };

/** Fishball Fiesta cards: cream sticker cards with a colour stripe, gold foil for golden cards, gold wild, red scatter. */
export const FISHBALL_CARD_STYLE: ICardStyle = {
  look(cell: Cell): CardLook {
    if (cell.s === 'WILD') return { fill: '#f2b705', ring: WILD_RING, ringWidth: 3, glow: WILD_GLOW, artScale: 0.96, gold: false };
    if (cell.s === 'SC') return { fill: '#be123c', ring: SCATTER_RING, ringWidth: 3, glow: SCATTER_GLOW, artScale: 0.96, gold: false };
    return { fill: cell.g ? '#d4a017' : '#fff1d0', accent: ACCENT[cell.s] ?? '#555555', artScale: 0.88, gold: !!cell.g };
  },
  frameName: (cell: Cell) => `sym_${cell.s}`,
};
