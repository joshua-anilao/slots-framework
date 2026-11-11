import type { GameConfig } from './config';

/** Thrown when a game.json is invalid. Lists every problem found. */
export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid game config:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}

/** Checks a config for mistakes that would break the engine. Throws {@link ConfigError}. */
export function validateConfig(c: GameConfig): void {
  const p: string[] = [];
  const ids = new Set<string>();
  for (const s of c.symbols) {
    if (ids.has(s.id)) p.push(`Duplicate symbol id "${s.id}"`);
    ids.add(s.id);
    if (s.kind === 'normal' && !s.pays) p.push(`Symbol "${s.id}" has no pays`);
  }
  if (c.grid.reels < 3 || c.grid.rows < 1) p.push('Grid must have at least 3 reels and 1 row');
  if (!ids.has(c.wildSymbol)) p.push(`wildSymbol "${c.wildSymbol}" is not a symbol`);
  if (c.freeSpins.enabled && !ids.has(c.freeSpins.scatterSymbol)) p.push(`scatterSymbol "${c.freeSpins.scatterSymbol}" is not a symbol`);
  for (const set of ['base', 'free'] as const) {
    const strips = c.reelSets[set];
    if (strips.length !== c.grid.reels) p.push(`reelSets.${set} has ${strips.length} reels, grid needs ${c.grid.reels}`);
    strips.forEach((strip, i) => {
      if (strip.length < c.grid.rows) p.push(`reelSets.${set}[${i}] is shorter than the grid`);
      for (const id of strip) if (!ids.has(id)) { p.push(`reelSets.${set}[${i}] uses unknown symbol "${id}"`); break; }
    });
  }
  for (const r of c.golden.reels) if (r < 0 || r >= c.grid.reels) p.push(`golden.reels has invalid reel ${r}`);
  for (const k of ['chanceBase', 'chanceFree'] as const) {
    if (c.golden[k] < 0 || c.golden[k] > 1) p.push(`golden.${k} must be between 0 and 1`);
  }
  const m = c.multiplier;
  if (!['A', 'B', 'C', 'D'].includes(m.variant)) p.push(`multiplier.variant must be A, B, C or D`);
  for (const v of ['A', 'C'] as const) {
    if (!m[v].base.length || !m[v].free.length) p.push(`multiplier.${v} ladders must not be empty`);
  }
  for (const [v, x] of Object.entries(m.payScale ?? {})) {
    if (!(typeof x === 'number' && x > 0)) p.push(`multiplier.payScale.${v} must be a positive number`);
  }
  if (c.bet.levels.length === 0) p.push('bet.levels is empty');
  if (c.bet.defaultIndex < 0 || c.bet.defaultIndex >= c.bet.levels.length) p.push('bet.defaultIndex is out of range');
  if (!(c.maxWinX > 0)) p.push('maxWinX must be positive');
  if (c.buyBonus.enabled && !(c.buyBonus.priceX > 0)) p.push('buyBonus.priceX must be positive');
  for (const [v, x] of Object.entries(c.buyBonus.priceXByVariant ?? {})) {
    if (!(typeof x === 'number' && x > 0)) p.push(`buyBonus.priceXByVariant.${v} must be a positive number`);
  }
  if (p.length) throw new ConfigError(p);
}
