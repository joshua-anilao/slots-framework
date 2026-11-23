import type { Cell } from '@slots/math-core';
import { el } from '../../framework/core/dom';
import { frameName } from '../../framework/theme/theme';
import type { Theme } from '../../framework/theme/theme';
import type { CharacterSpec } from '../../framework/character/characterRig';
import { VENDOR_PARTS, VENDOR_SCENE_BG } from './characterArt';
import { FOOD_ART } from './foodArt';

interface Look { glyph: string; tier: 'high' | 'low' | 'wild' | 'scatter' }

/**
 * Fishball Fiesta look: illustrated street food (game/theme/foodArt.ts) drawn straight on the board, no card tile.
 * WILD and SCATTER carry their word on a ribbon (styles.css). Placeholder art until the real art arrives under the same frame names.
 */
const LOOKS: Record<string, Look> = {
  H1: { glyph: '', tier: 'high' },   // fishball sticks
  H2: { glyph: '', tier: 'high' },   // halo-halo
  H3: { glyph: '', tier: 'high' },   // kwek-kwek
  H4: { glyph: '', tier: 'high' },   // barbecue
  L1: { glyph: '', tier: 'low' },    // banana cue
  L2: { glyph: '', tier: 'low' },    // mango
  L3: { glyph: '', tier: 'low' },    // corn
  L4: { glyph: '', tier: 'low' },    // puto
  WILD: { glyph: 'WILD', tier: 'wild' },
  SC: { glyph: 'SCATTER', tier: 'scatter' },
};
const FALLBACK: Look = { glyph: '?', tier: 'low' };

export class PlaceholderTheme implements Theme {
  readonly id = 'placeholder';
  /** Remove this line and the stage shows an empty scene. */
  readonly character: CharacterSpec = { kind: 'puppet', parts: VENDOR_PARTS, sceneBg: VENDOR_SCENE_BG };

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
