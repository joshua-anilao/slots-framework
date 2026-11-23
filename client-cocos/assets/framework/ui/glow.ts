import { Color, Graphics, Node, Tween, UIOpacity, tween } from 'cc';
import { GLOW_STYLE } from './glowStyle';
import type { GlowLook, GlowSpec, RadialStop } from './glowStyle';
import { glowBands, radialBands, sampleStops } from './glowMath';
import { hex, uiNode } from './uiKit';

/** A hex colour with an alpha between 0 and 1. */
export function withAlpha(color: string, alpha: number): Color {
  const c = hex(color);
  c.a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return c;
}

/**
 * Draws a glow and an optional solid ring OUTSIDE a centred rounded rect (or a circle when w === h and radius >= w / 2).
 * Nothing is drawn inside the shape, so the card or button it surrounds is never tinted. Clears `g` first.
 * The glow starts at the shape edge and is drawn first; the ring sits on top of it.
 */
export function drawGlow(g: Graphics, w: number, h: number, radius: number, look: GlowLook): void {
  g.clear();
  const circle = w === h && radius >= w / 2;
  /** Path of the shape grown by `grow` px on every side. */
  const path = (grow: number): void => {
    if (circle) g.circle(0, 0, w / 2 + grow);
    else g.roundRect(-w / 2 - grow, -h / 2 - grow, w + grow * 2, h + grow * 2, radius + grow);
  };
  if (look.glow) {
    for (const band of glowBands(look.glow, GLOW_STYLE.bandPx)) {
      g.strokeColor = withAlpha(look.glow.color, band.alpha);
      g.lineWidth = band.width;
      path(band.offset);
      g.stroke();
    }
  }
  if (look.ring) {
    g.strokeColor = hex(look.ring.color);
    g.lineWidth = look.ring.width;
    path(look.ring.width / 2);
    g.stroke();
  }
}

/** Draws a round glow (a gradient from the centre out to `radius`) as thin rings. Clears `g` first. */
export function drawRadialGlow(g: Graphics, radius: number, stops: RadialStop[]): void {
  g.clear();
  for (const band of radialBands(radius, stops, GLOW_STYLE.bandPx)) {
    const c = withAlpha(band.color, band.alpha);
    const inner = band.offset - band.width / 2;
    if (inner <= 0) {
      g.fillColor = c;
      g.circle(0, 0, band.offset + band.width / 2);
      g.fill();
    } else {
      g.strokeColor = c;
      g.lineWidth = band.width;
      g.circle(0, 0, band.offset);
      g.stroke();
    }
  }
}

/** Draws a light that is brightest in the middle of the width: vertical stripes, `stops` run from the left edge to the right edge. */
export function drawHorizontalLight(g: Graphics, w: number, h: number, stops: RadialStop[]): void {
  g.clear();
  const bandPx = GLOW_STYLE.bandPx;
  for (let x = 0; x < w; x += bandPx) {
    const width = Math.min(bandPx, w - x);
    const s = sampleStops(stops, (x + width / 2) / w);
    if (s.alpha <= 0) continue;
    g.fillColor = withAlpha(s.color, s.alpha);
    g.rect(-w / 2 + x, -h / 2, width, h);
    g.fill();
  }
}

/** A node with a glow drawn on it, inserted as the FIRST child of `parent` so it sits behind everything else. */
export function addGlow(parent: Node, name: string, w: number, h: number, radius: number, look: GlowLook): Node {
  const n = uiNode(name);
  drawGlow(n.addComponent(Graphics), w, h, radius, look);
  parent.addChild(n);
  n.setSiblingIndex(0);
  return n;
}

/** Redraws a glow node made by `addGlow`, or hides it when `glow` is undefined. */
export function setGlow(node: Node, w: number, h: number, radius: number, glow: GlowSpec | undefined): void {
  node.active = !!glow;
  if (glow) drawGlow(node.getComponent(Graphics) ?? node.addComponent(Graphics), w, h, radius, { glow });
}

/**
 * Two pre-drawn looks (rest and peak) that cross-fade back and forth: a pulse without redrawing every frame.
 * `start` is safe to call twice (it never stacks tweens); `stop` leaves the rest look showing.
 */
export class GlowPulse {
  readonly node: Node;
  private readonly restFade: UIOpacity;
  private readonly peakFade: UIOpacity;
  private readonly driver = { u: 0 };

  constructor(parent: Node, name: string, w: number, h: number, radius: number, rest: GlowLook, peak: GlowLook) {
    this.node = uiNode(name);
    const restNode = uiNode('Rest');
    const peakNode = uiNode('Peak');
    drawGlow(restNode.addComponent(Graphics), w, h, radius, rest);
    drawGlow(peakNode.addComponent(Graphics), w, h, radius, peak);
    this.restFade = restNode.addComponent(UIOpacity);
    this.peakFade = peakNode.addComponent(UIOpacity);
    this.node.addChild(restNode);
    this.node.addChild(peakNode);
    parent.addChild(this.node);
    this.node.setSiblingIndex(0);
    this.apply(0);
  }

  /** Rest to peak and back, once per `periodSec`, until `stop`. */
  start(periodSec: number, easing: 'linear' | 'sineInOut' = 'linear'): void {
    Tween.stopAllByTarget(this.driver);
    this.apply(0);
    tween(this.driver).repeatForever(tween<{ u: number }>()
      .to(periodSec / 2, { u: 1 }, { easing, onUpdate: () => this.apply(this.driver.u) })
      .to(periodSec / 2, { u: 0 }, { easing, onUpdate: () => this.apply(this.driver.u) })).start();
  }

  stop(): void {
    Tween.stopAllByTarget(this.driver);
    this.driver.u = 0;
    this.apply(0);
  }

  private apply(u: number): void {
    this.driver.u = u;
    this.restFade.opacity = Math.round(255 * (1 - u));
    this.peakFade.opacity = Math.round(255 * u);
  }
}
