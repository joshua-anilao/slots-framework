/**
 * Exports the prototype's placeholder food art to a Cocos sprite atlas (PNG + plist, TexturePacker format 3).
 * Frame names match the prototype: sym_H1 ... sym_WILD. Real art replaces the atlas under the same names.
 * Usage: npx tsx tools/exportArt.ts      (needs Playwright; set NODE_PATH to where it is installed)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { FOOD_ART } from '../prototype-web/src/game/theme/foodArt';

const CELL = 256, PAD = 2, COLS = 4;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'client-cocos/assets/resources/atlas');
const NAME = 'fishball';

const ids = Object.keys(FOOD_ART);
const rows = Math.ceil(ids.length / COLS);
const W = COLS * (CELL + PAD) + PAD, H = rows * (CELL + PAD) + PAD;
const pos = (i: number) => ({ x: PAD + (i % COLS) * (CELL + PAD), y: PAD + Math.floor(i / COLS) * (CELL + PAD) });

// Playwright is not a project dependency; it is found through NODE_PATH or the project's node_modules.
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const tiles = ids.map((id, i) => {
  const { x, y } = pos(i);
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${CELL}px;height:${CELL}px">${FOOD_ART[id]!.replace('<svg ', `<svg width="${CELL}" height="${CELL}" `)}</div>`;
}).join('');
await page.setContent(`<body style="margin:0;background:transparent;width:${W}px;height:${H}px;position:relative">${tiles}</body>`);
mkdirSync(outDir, { recursive: true });
await page.screenshot({ path: join(outDir, `${NAME}.png`), omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
await browser.close();

const frames = ids.map((id, i) => {
  const { x, y } = pos(i);
  return `    <key>sym_${id}</key>\n    <dict>\n      <key>aliases</key><array/>\n      <key>spriteOffset</key><string>{0,0}</string>\n      <key>spriteSize</key><string>{${CELL},${CELL}}</string>\n      <key>spriteSourceSize</key><string>{${CELL},${CELL}}</string>\n      <key>textureRect</key><string>{{${x},${y}},{${CELL},${CELL}}}</string>\n      <key>textureRotated</key><false/>\n    </dict>`;
}).join('\n');
writeFileSync(join(outDir, `${NAME}.plist`), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>frames</key>
  <dict>
${frames}
  </dict>
  <key>metadata</key>
  <dict>
    <key>format</key><integer>3</integer>
    <key>pixelFormat</key><string>RGBA8888</string>
    <key>premultiplyAlpha</key><false/>
    <key>realTextureFileName</key><string>${NAME}.png</string>
    <key>size</key><string>{${W},${H}}</string>
    <key>smartupdate</key><string>$none</string>
    <key>textureFileName</key><string>${NAME}.png</string>
  </dict>
</dict>
</plist>
`);
console.log(`Exported ${ids.length} frames to ${outDir} (${W}x${H}).`);
