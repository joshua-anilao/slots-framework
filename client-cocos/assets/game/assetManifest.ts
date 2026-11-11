import type { AssetGroups } from '../framework/assets/assetLoader';

/** Fishball Fiesta asset groups. Frame names match the prototype and the art guide (sym_<id>). */
export const SYMBOL_FRAMES = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'SC', 'WILD'].map(id => `sym_${id}`);

export const ASSET_GROUPS: AssetGroups = {
  // Needed before the first spin: the symbols.
  boot: [{ path: 'atlas/fishball', frames: SYMBOL_FRAMES, files: ['atlas/fishball.png', 'atlas/fishball.plist'] }],
  // Popups, big win art and sounds join here as those modules arrive.
  lazy: [],
};
