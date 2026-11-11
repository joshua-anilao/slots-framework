/**
 * Renders the prototype's synthesised sounds to WAV files for the Cocos client (resources/audio/<name>[_<level>].wav).
 * Real recorded sounds replace the files under the same names. Usage: NODE_PATH=<playwright dir> npx tsx tools/exportSounds.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { SFX } from '../client-cocos/assets/game/audioManifest';
import { clipKey } from '../client-cocos/assets/framework/audio/audioManager';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'client-cocos/assets/resources/audio');
const RATE = 22050, MAX_SECONDS = 3.2;

const bundle = buildSync({
  entryPoints: [join(root, 'prototype-web/src/framework/core/audio.ts')],
  bundle: true, format: 'iife', globalName: 'SFXMOD', write: false,
}).outputFiles[0]!.text;

const jobs: Array<{ key: string; name: string; level: number }> = [];
for (const s of SFX) {
  const levels = s.maxLevel === undefined ? [0] : Array.from({ length: s.maxLevel + 1 }, (_, i) => i);
  for (const level of levels) jobs.push({ key: clipKey(s, level), name: s.name, level });
}

const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');
await page.addScriptTag({ content: bundle });
const rendered: Record<string, number[]> = await page.evaluate(async ({ jobs, rate, seconds }: { jobs: Array<{ key: string; name: string; level: number }>; rate: number; seconds: number }) => {
  const out: Record<string, number[]> = {};
  for (const j of jobs) {
    const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
    const fx = new (window as any).SFXMOD.SoundFx();
    fx.useContext(ctx);
    fx.play(j.name, j.level);
    const data = (await ctx.startRendering()).getChannelData(0);
    let end = data.length;
    while (end > 0 && Math.abs(data[end - 1]!) < 0.0003) end--; // cut the silent tail
    end = Math.min(data.length, end + Math.round(rate * 0.03));
    out[j.key] = Array.from(data.subarray(0, end), v => Math.max(-32768, Math.min(32767, Math.round(v * 32767))));
  }
  return out;
}, { jobs, rate: RATE, seconds: MAX_SECONDS });
await browser.close();

const wav = (samples: number[]): Buffer => {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(v, 44 + i * 2));
  return b;
};
mkdirSync(outDir, { recursive: true });
let total = 0;
for (const [key, samples] of Object.entries(rendered)) { const buf = wav(samples); total += buf.length; writeFileSync(join(outDir, `${key}.wav`), buf); }
console.log(`Exported ${jobs.length} sounds to ${outDir} (${(total / 1024).toFixed(0)} KB).`);
