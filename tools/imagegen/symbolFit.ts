/**
 * Fits a transparent symbol image into an atlas cell the same way the placeholder art sits in it:
 * trim the empty border, scale the art (never distorting it) until it touches the cell edges on its
 * longer side, and centre it. The placeholder atlas does exactly this (tall skewers touch the top and
 * bottom, wide food touches the left and right).
 */
import sharp from 'sharp';

export const CELL = 256;

/** Smallest box that holds every pixel with alpha above the threshold. Null when the image is empty. */
export function alphaBounds(rgba: Buffer, width: number, height: number, threshold = 10) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3]! > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Returns a CELL x CELL transparent PNG with the art trimmed, scaled to fit and centred. */
export async function fitToCell(input: Buffer, cell = CELL): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = alphaBounds(data, info.width, info.height);
  if (!box) throw new Error('The image has no visible pixels. Was the background removed?');
  const art = await sharp(input).ensureAlpha().extract(box)
    .resize(cell, cell, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const { width, height } = await sharp(art).metadata();
  return sharp({ create: { width: cell, height: cell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art, left: Math.floor((cell - width!) / 2), top: Math.floor((cell - height!) / 2) }])
    .png().toBuffer();
}
