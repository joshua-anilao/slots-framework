import type { GlowSpec, RadialStop } from './glowStyle';

/** One drawn ring (or stripe): `offset` is the distance of its centre from the shape edge (or from the centre for radial glows). */
export interface GlowBand { offset: number; width: number; alpha: number }
export type ColourBand = GlowBand & { color: string };

/** Bands fainter than this are not drawn. */
const MIN_ALPHA = 0.004;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Strength of a CSS-like glow at distance `d` outside the shape edge.
 * Full strength well inside the spread, exactly half at the spread edge, zero at `spread + blur` and beyond.
 */
export function glowAlphaAt(glow: GlowSpec, d: number): number {
  const spread = glow.spread ?? 0;
  return glow.alpha * (1 - smoothstep(spread - glow.blur, spread + glow.blur, d));
}

/** Thin rings from the shape edge outwards. They do not overlap, so each pixel gets exactly its band's alpha. */
export function glowBands(glow: GlowSpec, bandPx: number): GlowBand[] {
  const reach = (glow.spread ?? 0) + glow.blur;
  const count = Math.ceil(reach / bandPx);
  const bands: GlowBand[] = [];
  for (let i = 0; i < count; i++) {
    const offset = (i + 0.5) * bandPx;
    const alpha = glowAlphaAt(glow, offset);
    if (alpha >= MIN_ALPHA) bands.push({ offset, width: bandPx, alpha });
  }
  return bands;
}

const channel = (hex: string, i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, '0');

/** Colour and alpha of a gradient at position `at` (0 to 1): linear between the two neighbouring stops. */
export function sampleStops(stops: RadialStop[], at: number): { color: string; alpha: number } {
  const first = stops[0]!, last = stops[stops.length - 1]!;
  if (at <= first.at) return { color: first.color, alpha: first.alpha };
  if (at >= last.at) return { color: last.color, alpha: last.alpha };
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!, b = stops[i]!;
    if (at > b.at) continue;
    const t = (at - a.at) / (b.at - a.at);
    const mix = (k: number): number => channel(a.color, k) + (channel(b.color, k) - channel(a.color, k)) * t;
    return { color: `#${toHex(mix(0))}${toHex(mix(1))}${toHex(mix(2))}`, alpha: a.alpha + (b.alpha - a.alpha) * t };
  }
  return { color: last.color, alpha: last.alpha };
}

/** Rings from the centre out to `radius`; `offset` is the distance of the band centre from the centre. */
export function radialBands(radius: number, stops: RadialStop[], bandPx: number): ColourBand[] {
  const count = Math.ceil(radius / bandPx);
  const bands: ColourBand[] = [];
  for (let i = 0; i < count; i++) {
    const from = i * bandPx, to = Math.min(radius, from + bandPx);
    const offset = (from + to) / 2;
    const s = sampleStops(stops, offset / radius);
    if (s.alpha >= MIN_ALPHA) bands.push({ offset, width: to - from, alpha: s.alpha, color: s.color });
  }
  return bands;
}

/** CSS rotate is clockwise-positive; a Cocos node's angle is counter-clockwise-positive. */
export function cssToCocosAngle(cssDeg: number): number { return -cssDeg; }

/**
 * A rocking loop at time `t` (0 to 1): rest, one side (+1), rest, other side (-1), rest, one quarter each.
 * +1 means "top tilts left, body shifts left". With `eased` each quarter uses sine in-out, otherwise it is linear.
 */
export function rockAt(t: number, eased: boolean): number {
  const phase = ((t % 1) + 1) % 1 * 4;
  const quarter = Math.min(3, Math.floor(phase));
  const u = phase - quarter;
  const k = eased ? (1 - Math.cos(Math.PI * u)) / 2 : u;
  return [k, 1 - k, -k, k - 1][quarter]!;
}
