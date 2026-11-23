import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { glowAlphaAt, glowBands, radialBands, rockAt, sampleStops } from '../client-cocos/assets/framework/ui/glowMath';
import { GLOW_STYLE } from '../client-cocos/assets/framework/ui/glowStyle';
import type { GlowSpec } from '../client-cocos/assets/framework/ui/glowStyle';

const HEX = /^#[0-9a-f]{6}$/i;

function allGlows(): GlowSpec[] {
  const s = GLOW_STYLE;
  return [s.win.glow, s.beam.glow, s.celebrate.rest.glow!, s.celebrate.peak.glow!, s.goldCard.glow, s.multStep.base, s.multStep.free,
    s.spin.rest, s.spin.peak, s.spin.disabled, s.buy.glow, s.turbo.turbo, s.turbo.super, s.winnerNotice.glow, s.fsTitle.label.glow, s.fsTitle.count.glow];
}

describe('GLOW_STYLE HUD and card values (AC 1, 15-18, 20-24)', () => {
  it('has valid colours and alphas everywhere', () => {
    for (const g of allGlows()) {
      expect(g.color).toMatch(HEX);
      expect(g.alpha).toBeGreaterThan(0);
      expect(g.alpha).toBeLessThanOrEqual(1);
      expect(g.blur).toBeGreaterThan(0);
    }
    for (const st of [...GLOW_STYLE.beam.light, ...GLOW_STYLE.winBurst.stops]) expect(st.color).toMatch(HEX);
  });

  it('matches the spec table for multiplier, buy, turbo, notice and title', () => {
    expect(GLOW_STYLE.multStep.base).toEqual({ color: '#f5c542', alpha: 0.8, blur: 24 });
    expect(GLOW_STYLE.multStep.free).toEqual({ color: '#29d3c0', alpha: 0.8, blur: 24 });
    expect(GLOW_STYLE.buy.glow).toEqual({ color: '#f5c542', alpha: 0.5, blur: 18 });
    expect(GLOW_STYLE.buy.edge).toEqual({ color: '#6b4300', width: 4 });
    expect(GLOW_STYLE.turbo.turbo).toEqual({ color: '#f5c542', alpha: 0.6, blur: 14 });
    expect(GLOW_STYLE.winnerNotice.glow).toEqual({ color: '#f5c542', alpha: 0.6, blur: 18 });
    expect(GLOW_STYLE.goldCard.glow).toEqual({ color: '#f5c542', alpha: 0.9, blur: 18 });
    expect(GLOW_STYLE.fsTitle.label).toEqual({ color: '#b5fff6', glow: { color: '#29d3c0', alpha: 1, blur: 12 } });
    expect(GLOW_STYLE.fsTitle.count.color).toBe('#ffffff');
    expect(GLOW_STYLE.fsTitle.count.outline).toBe('#0b5f57');
    expect(GLOW_STYLE.celebrate.rest.ring).toEqual({ color: '#b5fff6', width: 3 });
    expect(GLOW_STYLE.celebrate.rest.glow).toEqual({ color: '#29d3c0', alpha: 1, blur: 20 });
    expect(GLOW_STYLE.bandPx).toBe(2);
  });

  it('beam light is symmetric, transparent at the edges, brightest in the centre', () => {
    const l = GLOW_STYLE.beam.light;
    expect(l[0]!.alpha).toBe(0);
    expect(l[l.length - 1]!.alpha).toBe(0);
    expect(sampleStops(l, 0.5).alpha).toBe(0.85);
    expect(sampleStops(l, 0.3).alpha).toBeCloseTo(0.55, 6);
    for (const d of [0.1, 0.2, 0.35, 0.45]) expect(sampleStops(l, d).alpha).toBeCloseTo(sampleStops(l, 1 - d).alpha, 6);
  });

  it('win burst keyframes match the spec', () => {
    const b = GLOW_STYLE.winBurst;
    expect([b.opacityStart, b.opacityMid, b.opacityEnd]).toEqual([0.95, 0.6, 0]);
    expect(b.easing).toBe('quartOut');
    expect(b.stops.map(s => s.at)).toEqual([0, 0.45, 1]);
  });
});

describe('glow maths edge cases', () => {
  it('a glow with no spread is half strength at the edge and gone at blur', () => {
    const g: GlowSpec = { color: '#ffffff', alpha: 0.8, blur: 10 };
    expect(glowAlphaAt(g, 0)).toBeCloseTo(0.4, 6);
    expect(glowAlphaAt(g, 10)).toBeCloseTo(0, 6);
  });

  it('band alpha follows glowAlphaAt at the band centre', () => {
    for (const g of allGlows()) {
      for (const b of glowBands(g, GLOW_STYLE.bandPx)) expect(b.alpha).toBeCloseTo(glowAlphaAt(g, b.offset), 6);
    }
  });

  it('bands are never negative in alpha or width, for several band sizes', () => {
    for (const px of [1, 2, 3, 5]) {
      for (const b of glowBands(GLOW_STYLE.beam.glow, px)) {
        expect(b.alpha).toBeGreaterThanOrEqual(0);
        expect(b.width).toBeGreaterThan(0);
      }
    }
  });

  it('radial bands carry a colour for every band and handle a tiny radius', () => {
    const bands = radialBands(3, GLOW_STYLE.winBurst.stops, 2);
    expect(bands.length).toBeGreaterThan(0);
    for (const b of bands) expect(b.color).toMatch(HEX);
  });

  it('rockAt is periodic-safe at the ends and stays within -1..1', () => {
    for (let t = 0; t < 1; t += 0.01) {
      for (const eased of [true, false]) {
        const v = rockAt(t, eased);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
        expect(v).toBeGreaterThanOrEqual(-1 - 1e-9);
      }
    }
  });
});

describe('engine safety in the glow files (AC 26)', () => {
  const dir = new URL('../client-cocos/assets/', import.meta.url);
  const files = ['framework/ui/glow.ts', 'framework/ui/glowMath.ts', 'framework/ui/glowStyle.ts', 'framework/board/symbolView.ts', 'framework/board/boardView.ts',
    'framework/hud/winBox.ts', 'framework/hud/controlBar.ts', 'framework/hud/multiplierBar.ts', 'framework/hud/titleBar.ts', 'framework/hud/winnerNotice.ts'];

  it('never calls Tween.stopAll()', () => {
    for (const f of files) expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(/Tween\.stopAll\s*\(/);
  });

  it('glowMath and glowStyle import nothing from cc', () => {
    for (const f of ['framework/ui/glowMath.ts', 'framework/ui/glowStyle.ts']) expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(/from\s+['"]cc['"]/);
  });

  it('view files read glow numbers from GLOW_STYLE (no inline "blur:" literals)', () => {
    for (const f of files.filter(x => !x.endsWith('glowStyle.ts'))) {
      expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(/blur:\s*\d/);
    }
  });
});
