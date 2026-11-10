import type { Cell } from '@slots/math-core';
import { el } from '../../framework/core/dom';
import { frameName } from '../../framework/theme/theme';
import type { Theme } from '../../framework/theme/theme';
import { FOOD_ART } from './foodArt';

interface Look { glyph: string; accent: string; tier: 'high' | 'low' | 'wild' | 'scatter' }

/**
 * Fishball Fiesta look: cream sticker cards with an illustrated street food (game/theme/foodArt.ts)
 * and a colour stripe per tier. Placeholder art until the real art arrives under the same frame names.
 */
const LOOKS: Record<string, Look> = {
  H1: { glyph: '', accent: '#c2410c', tier: 'high' },   // fishball sticks
  H2: { glyph: '', accent: '#7b2cbf', tier: 'high' },   // halo-halo
  H3: { glyph: '', accent: '#ea580c', tier: 'high' },   // kwek-kwek
  H4: { glyph: '', accent: '#9f1239', tier: 'high' },   // barbecue
  L1: { glyph: '', accent: '#b45309', tier: 'low' },    // banana cue
  L2: { glyph: '', accent: '#d97706', tier: 'low' },    // mango
  L3: { glyph: '', accent: '#ca8a04', tier: 'low' },    // corn
  L4: { glyph: '', accent: '#65a30d', tier: 'low' },    // puto
  WILD: { glyph: 'WILD', accent: '#f2b705', tier: 'wild' },
  SC: { glyph: 'SCATTER', accent: '#e11d48', tier: 'scatter' },
};
const FALLBACK: Look = { glyph: '?', accent: '#555', tier: 'low' };

export class PlaceholderTheme implements Theme {
  readonly id = 'placeholder';

  symbol(cell: Cell): HTMLElement {
    const look = LOOKS[cell.s] ?? FALLBACK;
    const art = FOOD_ART[cell.s];
    const node = el(`div.sym.t-${look.tier}${art ? '.food' : ''}${cell.g ? '.gold' : ''}`, { dataset: { frame: frameName(cell), s: cell.s } });
    if (art) {
      const holder = el('span.art');
      holder.innerHTML = art; // our own static SVG strings
      node.append(holder);
    }
    if (look.glyph) node.append(el('span.glyph', { text: look.glyph }));
    // Wild: gold tile. Scatter: red tile. Food cards: cream, with the tier colour as a stripe.
    const plain = look.tier === 'wild' ? '#f2b705' : look.tier === 'scatter' ? '#be123c' : '#fff1d0';
    node.style.setProperty('--bg', cell.g ? '#d4a017' : plain);
    node.style.setProperty('--fg', look.tier === 'wild' ? '#3b2300' : look.tier === 'scatter' ? '#fff1f2' : '#3a1f12');
    node.style.setProperty('--accent', look.accent);
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
