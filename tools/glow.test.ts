import { describe, expect, it } from 'vitest';
import { cssToCocosAngle, glowAlphaAt, glowBands, radialBands, rockAt, sampleStops } from '../client-cocos/assets/framework/ui/glowMath';
import { GLOW_STYLE } from '../client-cocos/assets/framework/ui/glowStyle';
import type { GlowSpec } from '../client-cocos/assets/framework/ui/glowStyle';

const WIN_GLOW: GlowSpec = GLOW_STYLE.win.glow;
const BEAM_GLOW: GlowSpec = GLOW_STYLE.beam.glow;

describe('glowAlphaAt', () => {
  it('is half strength at the spread edge, zero at spread + blur, full well inside', () => {
    expect(glowAlphaAt(BEAM_GLOW, 12)).toBeCloseTo(BEAM_GLOW.alpha / 2, 6);
    expect(glowAlphaAt(BEAM_GLOW, 52)).toBeCloseTo(0, 6);
    expect(glowAlphaAt(BEAM_GLOW, 80)).toBe(0);
    expect(glowAlphaAt(BEAM_GLOW, 12 - 40)).toBeCloseTo(BEAM_GLOW.alpha, 6);
    expect(glowAlphaAt(WIN_GLOW, 0)).toBeCloseTo(WIN_GLOW.alpha / 2, 6);
  });

  it('never rises with distance', () => {
    for (const g of [WIN_GLOW, BEAM_GLOW, GLOW_STYLE.spin.peak]) {
      let last = Infinity;
      for (let d = -10; d <= 100; d += 0.5) {
        const a = glowAlphaAt(g, d);
        expect(a).toBeLessThanOrEqual(last + 1e-12);
        last = a;
      }
    }
  });
});

describe('glowBands', () => {
  it('draws thin bands outward that fade out and never overlap', () => {
    const bands = glowBands(WIN_GLOW, 2);
    expect(bands.length).toBeGreaterThan(10);
    bands.forEach((b, i) => {
      expect(b.width).toBe(2);
      expect(b.offset).toBeCloseTo(i * 2 + 1, 6);
    });
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.offset - bands[i - 1]!.offset).toBeCloseTo(2, 6);
      expect(bands[i]!.alpha).toBeLessThanOrEqual(bands[i - 1]!.alpha);
    }
  });

  it('reaches no further than spread + blur', () => {
    const last = glowBands(BEAM_GLOW, 2).pop()!;
    expect(last.offset - last.width / 2).toBeLessThan(52);
    expect(glowBands(BEAM_GLOW, 2).every(b => b.offset <= 52)).toBe(true);
  });

  it('has a band at half strength near the spread edge', () => {
    const near = glowBands(BEAM_GLOW, 2).find(b => Math.abs(b.offset - 13) < 0.01)!;
    expect(near.alpha).toBeLessThan(BEAM_GLOW.alpha * 0.55);
    expect(near.alpha).toBeGreaterThan(BEAM_GLOW.alpha * 0.45);
  });
});

describe('radialBands and sampleStops', () => {
  const stops = GLOW_STYLE.winBurst.stops;

  it('interpolates colour and alpha between stops', () => {
    expect(sampleStops(stops, 0).alpha).toBeCloseTo(0.95, 6);
    expect(sampleStops(stops, 0.45)).toEqual({ color: '#f5c542', alpha: 0.55 });
    expect(sampleStops(stops, 1).alpha).toBe(0);
    expect(sampleStops(stops, 0.225).alpha).toBeCloseTo((0.95 + 0.55) / 2, 6);
  });

  it('covers the radius from the centre without gaps and fades out', () => {
    const bands = radialBands(280, stops, 2);
    expect(bands[0]!.offset).toBeCloseTo(1, 6);
    for (let i = 1; i < bands.length; i++) expect(bands[i]!.offset - bands[i - 1]!.offset).toBeCloseTo(2, 6);
    expect(bands[bands.length - 1]!.alpha).toBeLessThan(0.05);
  });
});

describe('angles and rocking', () => {
  it('flips the CSS rotation sign for Cocos', () => {
    expect(cssToCocosAngle(-2.5)).toBe(2.5);
    expect(cssToCocosAngle(4)).toBe(-4);
  });

  it('rocks rest, one side, rest, other side, rest', () => {
    for (const eased of [true, false]) {
      expect(rockAt(0, eased)).toBeCloseTo(0, 6);
      expect(rockAt(0.25, eased)).toBeCloseTo(1, 6);
      expect(rockAt(0.5, eased)).toBeCloseTo(0, 6);
      expect(rockAt(0.75, eased)).toBeCloseTo(-1, 6);
      expect(rockAt(0.999999, eased)).toBeCloseTo(0, 3);
    }
    expect(rockAt(0.125, false)).toBeCloseTo(0.5, 6);
  });
});

describe('GLOW_STYLE values from the prototype CSS', () => {
  it('has the win, beam and celebrate numbers', () => {
    expect(GLOW_STYLE.win.ring).toEqual({ color: '#ffe37a', width: 4 });
    expect(GLOW_STYLE.win.glow.blur).toBe(26);
    expect(GLOW_STYLE.win.sway).toEqual({ periodSec: 1, shiftPx: 7, tiltDeg: 2.5 });
    expect(GLOW_STYLE.beam.ring).toEqual({ color: '#fff3b0', width: 3 });
    expect(GLOW_STYLE.beam.glow).toEqual({ color: '#f5c542', alpha: 0.75, blur: 40, spread: 12 });
    expect(GLOW_STYLE.beam.pulse).toEqual({ min: 0.65, max: 1, halfSec: 0.5 });
    expect(GLOW_STYLE.celebrate.periodSec).toBe(0.5);
    expect(GLOW_STYLE.celebrate.anticipationPeriodSec).toBe(0.45);
    expect(GLOW_STYLE.celebrate.tiltDeg).toBe(4);
    expect(GLOW_STYLE.celebrate.rest.glow!.blur).toBe(20);
    expect(GLOW_STYLE.celebrate.peak.glow!.blur).toBe(46);
    expect(GLOW_STYLE.celebrate.peak.ring).toEqual({ color: '#ffffff', width: 5 });
    expect(GLOW_STYLE.dimGlowFactor).toBe(0.28);
  });

  it('has the HUD numbers', () => {
    expect(GLOW_STYLE.spin.periodSec).toBe(2.4);
    expect(GLOW_STYLE.spin.rest).toMatchObject({ alpha: 0.5, blur: 26 });
    expect(GLOW_STYLE.spin.peak).toMatchObject({ alpha: 0.95, blur: 46 });
    expect(GLOW_STYLE.spin.disabled).toMatchObject({ alpha: 0.65, blur: 34 });
    expect(GLOW_STYLE.winBurst).toMatchObject({ width: 560, height: 150, durationMs: 380, scaleStart: 0.25, scaleMid: 1, scaleEnd: 1.5, midAt: 0.55 });
    expect(GLOW_STYLE.turbo.super).toMatchObject({ color: '#ff4f8b', alpha: 0.8, blur: 18 });
    expect(GLOW_STYLE.goldCard.rings.map(r => r.color)).toEqual(['#fff6c8', '#8a6200']);
    expect(GLOW_STYLE.fsTitle.count.glow.blur).toBe(24);
  });
});
