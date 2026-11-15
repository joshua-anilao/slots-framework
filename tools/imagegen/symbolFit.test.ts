import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { alphaBounds, CELL, fitToCell } from './symbolFit';
import { parsePlistFrames } from './buildSymbols';

/** A transparent canvas with one opaque rectangle. */
const art = (w: number, h: number, box: { x: number; y: number; w: number; h: number }) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: box.w, height: box.h, channels: 4, background: { r: 200, g: 120, b: 20, alpha: 1 } } }, left: box.x, top: box.y }])
    .png().toBuffer();

const boundsOf = async (png: Buffer) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { size: [info.width, info.height], box: alphaBounds(data, info.width, info.height) };
};

describe('fitToCell', () => {
  it('makes a tall skewer touch the top and bottom of the cell, centred', async () => {
    const out = await boundsOf(await fitToCell(await art(928, 1152, { x: 400, y: 40, w: 120, h: 1000 })));
    expect(out.size).toEqual([CELL, CELL]);
    expect(out.box).toMatchObject({ top: 0, height: CELL });
    expect(Math.abs(out.box!.left + out.box!.width / 2 - CELL / 2)).toBeLessThanOrEqual(1);
  });

  it('makes wide food touch the left and right, centred vertically, without stretching it', async () => {
    const out = await boundsOf(await fitToCell(await art(1000, 1000, { x: 100, y: 300, w: 800, h: 400 })));
    expect(out.box).toMatchObject({ left: 0, width: CELL });
    expect(out.box!.height).toBeCloseTo(CELL / 2, -1);
    expect(Math.abs(out.box!.top + out.box!.height / 2 - CELL / 2)).toBeLessThanOrEqual(1);
  });

  it('rejects an image with no visible pixels', async () => {
    await expect(fitToCell(await art(100, 100, { x: 0, y: 0, w: 1, h: 1 }).then(() => sharp({ create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer())))
      .rejects.toThrow(/no visible pixels/);
  });
});

describe('atlas plist', () => {
  it('lists the 10 frames of the placeholder atlas with 256 px cells', () => {
    const frames = parsePlistFrames(readFileSync('client-cocos/assets/resources/atlas/fishball.plist', 'utf8'));
    expect(frames.map(f => f.name)).toEqual(['sym_H1', 'sym_H2', 'sym_H3', 'sym_H4', 'sym_L1', 'sym_L2', 'sym_L3', 'sym_L4', 'sym_SC', 'sym_WILD']);
    expect(frames.every(f => f.w === CELL && f.h === CELL)).toBe(true);
  });
});

describe('pickGenerated', () => {
  it('picks the newest batch and the requested candidate', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { pickGenerated } = await import('./buildSymbols');
    const theme = mkdtempSync(join(tmpdir(), 'theme-'));
    const dir = join(theme, 'generated', 'sym_H1');
    mkdirSync(dir, { recursive: true });
    for (const f of ['sym_H1_flux-dev_20261113-010000_1.png', 'sym_H1_flux-dev_20261113-020000_1.png', 'sym_H1_flux-dev_20261113-020000_2.png', 'sym_H1_flux-dev_20261113-020000_1.json']) writeFileSync(join(dir, f), '');
    expect(pickGenerated(theme, 'sym_H1', 'generated')).toMatch(/020000_1\.png$/);
    expect(pickGenerated(theme, 'sym_H1', 'generated:2')).toMatch(/020000_2\.png$/);
    expect(() => pickGenerated(theme, 'sym_H1', 'generated:3')).toThrow(/no number 3/);
    expect(() => pickGenerated(theme, 'sym_H9', 'generated')).toThrow(/art:gen first/);
  });
});
