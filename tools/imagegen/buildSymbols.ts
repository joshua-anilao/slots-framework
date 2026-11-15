/**
 * Turns approved, background-removed symbol images into drop-in atlas art.
 *
 *   npm run art:symbols -- games/game-001 [--base <atlas.png>] [--install]
 *
 * Reads games/<id>/theme/symbols.json, a map of frame name to image. A value can be:
 *   - an https URL:                "https://.../h1.png"
 *   - a file path (from theme/):   "generated/sym_H2/sym_H2_flux-dev_20261113-0100_2.png"
 *   - "generated"                  the first image of the newest `npm run art:gen` batch for that frame
 *   - "generated:3"                candidate number 3 of the newest batch
 * Images from art:gen with `"transparent": true` already have the background removed.
 * For each frame it downloads the image (a copy is kept in theme/source/, because fal links expire),
 * fits it into a 256x256 cell exactly like the placeholder art (see symbolFit.ts), and writes:
 *   games/<id>/theme/symbols/<frame>.png          the single 256x256 frames
 *   games/<id>/theme/atlas/<name>.png + .plist    the atlas, same layout and frame names as the current one
 * Frames not listed in symbols.json are copied unchanged from the base atlas, so the game keeps working
 * while art is replaced piece by piece.
 * --install copies the two atlas files over client-cocos/assets/resources/atlas/ (overwrites the current atlas).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CELL, fitToCell } from './symbolFit';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ATLAS_NAME = 'fishball';
const atlasDir = join(root, 'client-cocos/assets/resources/atlas');

export interface FrameRect { name: string; x: number; y: number; w: number; h: number }

/** Reads frame names and rectangles from a TexturePacker format 3 plist. */
export function parsePlistFrames(plist: string): FrameRect[] {
  const re = /<key>(sym_\w+)<\/key>[\s\S]*?<key>textureRect<\/key><string>\{\{(\d+),(\d+)\},\{(\d+),(\d+)\}\}<\/string>/g;
  return [...plist.matchAll(re)].map(m => ({ name: m[1]!, x: +m[2]!, y: +m[3]!, w: +m[4]!, h: +m[5]! }));
}

/** Resolves "generated" or "generated:N" to the matching file in theme/generated/<frame>/. */
export function pickGenerated(themeDir: string, frame: string, spec: string): string {
  const dir = join(themeDir, 'generated', frame);
  const files = existsSync(dir) ? readdirSync(dir).filter(f => /\.(png|webp|jpg)$/.test(f)) : [];
  if (!files.length) throw new Error(`No generated images for ${frame}. Run npm run art:gen first (looked in ${dir}).`);
  const stamp = (f: string) => /_(\d{8}-\d{6})_\d+\./.exec(f)?.[1] ?? '';
  const newest = files.map(stamp).sort().at(-1)!;
  const batch = files.filter(f => stamp(f) === newest);
  const n = Number(spec.split(':')[1] ?? 1);
  const hit = batch.find(f => new RegExp(`_${n}\\.`).test(f));
  if (!hit) throw new Error(`${frame}: the newest batch has ${batch.length} image(s), no number ${n}.`);
  return join(dir, hit);
}

async function load(src: string, baseDir: string): Promise<Buffer> {
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Download failed (${res.status}): ${src}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFileSync(isAbsolute(src) ? src : resolve(baseDir, src));
}

async function main() {
  const args = process.argv.slice(2);
  const gameDir = resolve(args.find(a => !a.startsWith('--')) ?? '');
  if (!args.length || !existsSync(join(gameDir, 'theme/symbols.json'))) {
    throw new Error('Usage: npm run art:symbols -- games/game-001   (needs games/<id>/theme/symbols.json)');
  }
  const baseIdx = args.indexOf('--base');
  const basePng = baseIdx >= 0 ? resolve(args[baseIdx + 1]!) : join(atlasDir, `${ATLAS_NAME}.png`);
  const basePlist = join(dirname(basePng), `${ATLAS_NAME}.plist`);
  const frames = parsePlistFrames(readFileSync(basePlist, 'utf8'));
  const manifest: Record<string, string> = JSON.parse(readFileSync(join(gameDir, 'theme/symbols.json'), 'utf8'));

  const unknown = Object.keys(manifest).filter(k => !frames.some(f => f.name === k));
  if (unknown.length) throw new Error(`Not frames in the atlas: ${unknown.join(', ')}. Known: ${frames.map(f => f.name).join(', ')}`);

  const themeDir = join(gameDir, 'theme');
  for (const d of ['source', 'symbols', 'atlas']) mkdirSync(join(themeDir, d), { recursive: true });

  const overlays: sharp.OverlayOptions[] = [];
  const clears: sharp.OverlayOptions[] = [];
  for (const f of frames) {
    const src = manifest[f.name];
    if (!src) continue;
    const raw = await load(src.startsWith('generated') && !src.includes('/') ? pickGenerated(themeDir, f.name, src) : src, themeDir);
    if (/^https?:/.test(src)) writeFileSync(join(themeDir, 'source', `${f.name}.png`), raw);
    const cell = await fitToCell(raw, CELL);
    writeFileSync(join(themeDir, 'symbols', `${f.name}.png`), cell);
    // Clear the old pixels first so a smaller new image does not show the old art through.
    clears.push({ input: { create: { width: f.w, height: f.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }, left: f.x, top: f.y, blend: 'dest-out' });
    overlays.push({ input: cell, left: f.x, top: f.y });
    console.log(`  fitted ${f.name}`);
  }

  const out = join(themeDir, 'atlas');
  const base = await sharp(basePng).ensureAlpha().png().toBuffer();
  const withHoles = await sharp(base).composite(clears).png().toBuffer();
  await sharp(withHoles).composite(overlays).png().toFile(join(out, `${ATLAS_NAME}.png`));
  copyFileSync(basePlist, join(out, `${ATLAS_NAME}.plist`));
  console.log(`Atlas written to ${out} (${Object.keys(manifest).length} new frame(s), ${frames.length - Object.keys(manifest).length} kept from the base atlas).`);

  if (args.includes('--install')) {
    mkdirSync(atlasDir, { recursive: true });
    copyFileSync(join(out, `${ATLAS_NAME}.png`), join(atlasDir, `${ATLAS_NAME}.png`));
    copyFileSync(join(out, `${ATLAS_NAME}.plist`), join(atlasDir, `${ATLAS_NAME}.plist`));
    console.log(`Installed into ${atlasDir}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
