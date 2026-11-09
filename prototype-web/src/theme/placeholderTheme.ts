import type { Cell } from '@slots/math-core';
import { el } from '../core/dom';
import { frameName } from './theme';
import type { Theme } from './theme';

interface Look { glyph: string; bg: string; fg: string; tier: 'high' | 'low' | 'wild' | 'scatter' }

/** Coloured shapes and letters with the real frame names, so math and flow are playable before art exists. */
const LOOKS: Record<string, Look> = {
  H1: { glyph: '◆', bg: '#c0213d', fg: '#ffe2e8', tier: 'high' },
  H2: { glyph: '●', bg: '#7b2cbf', fg: '#f1e2ff', tier: 'high' },
  H3: { glyph: '▲', bg: '#1d6fd1', fg: '#e0efff', tier: 'high' },
  H4: { glyph: '■', bg: '#16934f', fg: '#ddffe9', tier: 'high' },
  L1: { glyph: 'A', bg: '#3a3550', fg: '#ff8fa3', tier: 'low' },
  L2: { glyph: 'K', bg: '#3a3550', fg: '#c9a0ff', tier: 'low' },
  L3: { glyph: 'Q', bg: '#3a3550', fg: '#8cc4ff', tier: 'low' },
  L4: { glyph: 'J', bg: '#3a3550', fg: '#8ff0b4', tier: 'low' },
  WILD: { glyph: 'WILD', bg: '#f2b705', fg: '#3b2300', tier: 'wild' },
  SC: { glyph: 'SCATTER', bg: '#00b3a4', fg: '#002b28', tier: 'scatter' },
};
const FALLBACK: Look = { glyph: '?', bg: '#555', fg: '#fff', tier: 'low' };

export class PlaceholderTheme implements Theme {
  readonly id = 'placeholder';

  symbol(cell: Cell): HTMLElement {
    const look = LOOKS[cell.s] ?? FALLBACK;
    const node = el(`div.sym.t-${look.tier}${cell.g ? '.gold' : ''}`, { dataset: { frame: frameName(cell), s: cell.s } }, [
      el('span.glyph', { text: look.glyph }),
    ]);
    // Gold version: gold foil tile; the glyph keeps its symbol colour so it stays recognisable.
    node.style.setProperty('--bg', cell.g ? '#d4a017' : look.bg);
    node.style.setProperty('--fg', cell.g ? look.bg : look.fg);
    if (cell.g) node.append(el('span.foil'));
    return node;
  }

  cardBack(): HTMLElement {
    return el('div.sym.back', { dataset: { frame: 'sym_back', s: 'BACK' } }, [el('span.back-mark', { text: '★' })]);
  }

  blurSymbol(id: string): HTMLElement {
    const n = this.symbol({ s: id, g: false });
    n.classList.add('blur');
    return n;
  }
}
