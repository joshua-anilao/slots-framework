/**
 * Builds reel strips from symbol weights and writes them into a game.json.
 * Usage: npx tsx tools/build-strips.ts games/game-001
 * Reads games/<id>/strip-weights.json:
 *   { "seed": 1, "stacks": { "L1": 2 }, "spacing": { "SC": 4 },
 *     "base": [ { "H1": 3, ... }, ...one per reel ], "free": [ ... ] }
 * Weights count BLOCKS; a symbol with stack 2 appears as pairs (fewer, bigger wins).
 * Same seed + weights = same strips. Spacing keeps e.g. scatters apart.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SeededRng } from '@slots/math-core';

type Weights = Record<string, number>;
const dir = process.argv[2];
if (!dir) { console.error('Usage: tsx tools/build-strips.ts games/<id>'); process.exit(1); }
const w = JSON.parse(readFileSync(join(dir, 'strip-weights.json'), 'utf8')) as { seed: number; stacks?: Record<string, number>; spacing: Record<string, number>; base: Weights[]; free: Weights[] };
const cfgPath = join(dir, 'game.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const rng = new SeededRng(w.seed);

function build(weights: Weights): string[] {
  const bag: string[] = [];
  for (const [id, n] of Object.entries(weights)) for (let i = 0; i < n; i++) bag.push(id);
  for (let attempt = 0; attempt < 20000; attempt++) {
    for (let i = bag.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    if (bag.some((b, i) => b === bag[(i + 1) % bag.length])) continue;
    const strip = bag.flatMap(id => new Array<string>(w.stacks?.[id] ?? 1).fill(id));
    if (ok(strip)) return strip;
  }
  throw new Error('Could not space symbols; lower the spacing or the counts');
}

function ok(strip: string[]): boolean {
  const n = strip.length;
  for (let i = 0; i < n; i++) {
    const gap = w.spacing[strip[i]] ?? 0;
    for (let d = 1; d <= gap; d++) if (strip[(i + d) % n] === strip[i]) return false;
  }
  return true;
}

cfg.reelSets = { base: w.base.map(build), free: w.free.map(build) };
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log(`Wrote strips: base ${cfg.reelSets.base.map((s: string[]) => s.length).join('/')}, free ${cfg.reelSets.free.map((s: string[]) => s.length).join('/')}`);
