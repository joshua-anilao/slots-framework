import { Color, Graphics, Label, Node, Sprite, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import type { SpriteFrame } from 'cc';
import type { Cell } from '../../shared/math-core/index';
import { GlowPulse, addGlow, setGlow } from '../ui/glow';
import { cssToCocosAngle, rockAt } from '../ui/glowMath';
import { GLOW_STYLE } from '../ui/glowStyle';
import type { GlowSpec } from '../ui/glowStyle';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';

/** What one symbol looks like. The game supplies it; the framework never knows the theme. */
export interface CardLook {
  /** Card fill (hex). */
  fill: string;
  /** Colour stripe along the bottom edge (hex), if any. */
  accent?: string;
  /** Ring just inside the card edge for special symbols (wild, scatter). */
  ring?: string;
  /** Width of that ring (px). */
  ringWidth?: number;
  /** Soft glow around the card (wild, scatter). Golden cards get theirs from the framework glow style. */
  glow?: GlowSpec;
  /** Word drawn under the art (WILD, SCATTER). */
  glyph?: string;
  glyphColor?: string;
  /** Size of the art as a share of the card width. */
  artScale: number;
  /** Golden card: gold foil look. */
  gold: boolean;
}

export interface ICardStyle {
  look(cell: Cell): CardLook;
  /** Sprite frame name for the symbol, for example "sym_H1". */
  frameName(cell: Cell): string;
}

const OUTLINE = '#3a1f12';
/** Card outline width and corner radius (px). */
const OUTLINE_WIDTH = 4;
const CARD_RADIUS = 14;
/** Ring width used when a look names a ring but no width. */
const DEFAULT_RING_WIDTH = 3;

/** A value that a looping tween counts from 0 to 1. */
interface Phase { t: number }

/**
 * One card on the board: coloured card, symbol sprite, optional word, glow, ring and dim cover.
 * Child order: Glow (first, behind) then art, foil, glyph, ring, dim.
 * Spine-ready: only this class knows how a symbol is drawn, so a skeleton can replace the sprite later.
 */
export class SymbolView {
  readonly node: Node;
  readonly fade: UIOpacity;
  private readonly bg: Graphics;
  private readonly art: Sprite;
  private readonly artNode: Node;
  private readonly glyph: Label;
  private readonly ring: Node;
  private readonly dimCover: Node;
  private readonly foil: Node;
  private readonly glowRoot: Node;
  private readonly glowFade: UIOpacity;
  private readonly restGlow: Node;
  private winGlow: Node | undefined;
  private pulse: GlowPulse | undefined;
  private cell: Cell;
  private back = false;
  private hasRestGlow = false;
  private winning = false;
  private celebrating = false;
  /** Win sway: x the card returns to. */
  private swayRestX = 0;
  private readonly sway: Phase = { t: 0 };
  private readonly rock: Phase = { t: 0 };

  constructor(private readonly frames: (name: string) => SpriteFrame, private readonly style: ICardStyle,
    private readonly w: number, private readonly h: number, cell: Cell) {
    this.cell = cell;
    this.node = uiNode('Symbol', w, h);
    this.bg = this.node.addComponent(Graphics);
    this.fade = this.node.addComponent(UIOpacity);
    this.glowRoot = uiNode('Glow');
    this.glowFade = this.glowRoot.addComponent(UIOpacity);
    this.restGlow = uiNode('RestGlow');
    this.glowRoot.addChild(this.restGlow);
    this.foil = uiNode('Foil', w, h);
    this.foil.active = false;
    this.artNode = uiNode('Art', w * 0.9, w * 0.9);
    this.art = this.artNode.addComponent(Sprite);
    this.art.sizeMode = Sprite.SizeMode.CUSTOM;
    this.glyph = makeLabel(this.node, '', 24, '#3a1f12', 0, -h * 0.3, w);
    this.ring = uiNode('Ring', w, h);
    this.ring.active = false;
    this.dimCover = uiNode('Dim', w, h);
    this.dimCover.active = false;
    this.node.addChild(this.glowRoot);
    this.node.addChild(this.artNode);
    this.node.addChild(this.foil);
    this.node.addChild(this.glyph.node);
    this.node.addChild(this.ring);
    this.node.addChild(this.dimCover);
    this.glowRoot.setSiblingIndex(0);
    this.setCell(cell);
  }

  get symbol(): string { return this.back ? 'BACK' : this.cell.s; }
  get isBack(): boolean { return this.back; }

  setCell(cell: Cell): void {
    this.cell = cell;
    this.back = false;
    this.node.setScale(1, 1, 1);
    const look = this.style.look(cell);
    const g = look.gold;
    // Card body: fill, outline, and the tier stripe along the bottom.
    drawRoundRect(this.bg, this.w, this.h, { fill: g ? '#d4a017' : look.fill, stroke: OUTLINE, strokeWidth: OUTLINE_WIDTH, radius: CARD_RADIUS });
    if (look.accent && !g) {
      this.bg.fillColor = hex(look.accent);
      this.bg.roundRect(-this.w / 2 + 5, -this.h / 2 + 5, this.w - 10, 9, 4);
      this.bg.fill();
    }
    this.paintRings(look);
    this.paintRestGlow(g ? GLOW_STYLE.goldCard.glow : look.glow);
    this.art.node.active = true;
    this.art.spriteFrame = this.frames(this.style.frameName(cell));
    const size = this.w * look.artScale;
    this.artNode.getComponent(UITransform)!.setContentSize(size, size);
    this.artNode.setPosition(0, look.glyph ? 10 : 2, 0);
    this.glyph.node.active = !!look.glyph;
    this.glyph.node.setPosition(0, -this.h * 0.3, 0);
    this.glyph.fontSize = Math.max(10, Math.round(this.w * 0.19));
    this.glyph.string = look.glyph ?? '';
    this.glyph.color = hex(look.glyphColor ?? '#3a1f12');
    this.paintFoil(g);
    this.setDim(false);
    this.setWin(false);
    this.setCelebrate(false);
  }

  /** Shows the red card back (a gold card that is about to become WILD). */
  showBack(): void {
    this.back = true;
    this.node.setScale(1, 1, 1);
    drawRoundRect(this.bg, this.w, this.h, { fill: '#a31818', stroke: '#f5c542', strokeWidth: 8, radius: CARD_RADIUS });
    this.bg.strokeColor = hex('#8f1515');
    this.bg.lineWidth = 6;
    for (let i = -3; i <= 3; i++) { this.bg.moveTo(-this.w / 2 + 10, i * 22); this.bg.lineTo(this.w / 2 - 10, i * 22 + 30); }
    this.bg.stroke();
    this.art.node.active = false;
    this.ring.active = false;
    this.foil.active = false;
    this.glyph.node.active = true;
    this.glyph.string = '★';
    this.glyph.node.setPosition(0, 0, 0);
    this.glyph.fontSize = Math.round(this.w * 0.55);
    this.glyph.color = hex('#f5c542');
    this.glyph.node.getComponent(UITransform)!.setContentSize(this.w, 100);
    this.setDim(false);
    this.setWin(false);
    this.setCelebrate(false);
  }

  /** Dims a card that is not part of a win. Its outer glow keeps only a share of its strength. */
  setDim(dim: boolean): void {
    this.dimCover.active = dim;
    this.glowFade.opacity = dim ? Math.round(255 * GLOW_STYLE.dimGlowFactor) : 255;
    if (!dim) return;
    const g = this.dimCover.getComponent(Graphics) ?? this.dimCover.addComponent(Graphics);
    g.clear();
    g.fillColor = new Color(0, 0, 0, 175);
    g.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, CARD_RADIUS);
    g.fill();
  }

  /**
   * Winning card: ring and halo outside the edge, and a 1 s sway (left and right with a small tilt, no scaling).
   * Turning it off puts the card back at the x it had, with angle 0, and brings back its normal look.
   * The board must have put the card at its final position before turning the win on.
   */
  setWin(on: boolean): void {
    Tween.stopAllByTarget(this.sway);
    if (this.winning) {
      this.node.setPosition(this.swayRestX, this.node.position.y, 0);
      this.node.angle = 0;
    }
    this.winning = on;
    if (on) {
      const win = GLOW_STYLE.win;
      this.swayRestX = this.node.position.x;
      if (!this.winGlow) this.winGlow = addGlow(this.glowRoot, 'WinGlow', this.glowW, this.glowH, this.glowRadius, { ring: win.ring, glow: win.glow });
      this.loop(this.sway, win.sway.periodSec, t => {
        const r = rockAt(t, true);
        this.node.setPosition(this.swayRestX - win.sway.shiftPx * r, this.node.position.y, 0);
        this.node.angle = cssToCocosAngle(-win.sway.tiltDeg * r);
      });
    }
    this.updateGlow();
  }

  /**
   * Scatter celebration: a rocking tilt while the ring and glow pulse; the card draws above its column-mates.
   * Safe to call twice: the old loop is stopped first. `false` stops everything and straightens the card.
   */
  setCelebrate(on: boolean, periodSec: number = GLOW_STYLE.celebrate.periodSec): void {
    Tween.stopAllByTarget(this.rock);
    if (this.celebrating) { this.pulse?.stop(); this.node.angle = 0; }
    this.celebrating = on;
    if (on) {
      const c = GLOW_STYLE.celebrate;
      if (!this.pulse) this.pulse = new GlowPulse(this.glowRoot, 'CelebrateGlow', this.glowW, this.glowH, this.glowRadius, c.rest, c.peak);
      this.pulse.start(periodSec);
      this.loop(this.rock, periodSec, t => { this.node.angle = cssToCocosAngle(-c.tiltDeg * rockAt(t, false)); });
      const parent = this.node.parent;
      if (parent) this.node.setSiblingIndex(parent.children.length - 1);
    }
    this.updateGlow();
  }

  /** Flips the card (a quick turn across its width), swapping what it shows halfway. Resolves when done. */
  flip(seconds: number, swap: () => void): Promise<void> {
    return new Promise(resolve => {
      tween(this.node)
        .to(seconds / 2, { scale: new Vec3(0.02, 1, 1) }, { easing: 'quadIn' })
        .call(() => {
          // swap() resets the card (and stops its tweens), so the second half is a fresh tween.
          swap();
          this.node.setScale(0.02, 1, 1);
          tween(this.node).to(seconds / 2, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).call(() => resolve()).start();
        })
        .start();
    });
  }

  // --- glow helpers ----------------------------------------------------------------------------

  /** The glow wraps the outer edge of the card outline. */
  private get glowW(): number { return this.w + OUTLINE_WIDTH; }
  private get glowH(): number { return this.h + OUTLINE_WIDTH; }
  private get glowRadius(): number { return CARD_RADIUS + OUTLINE_WIDTH / 2; }

  /** Inner rings just inside the card outline: the golden card's two rings, or the wild/scatter ring. */
  private paintRings(look: CardLook): void {
    const rg = this.ring.getComponent(Graphics) ?? this.ring.addComponent(Graphics);
    rg.clear();
    const rings = look.gold ? GLOW_STYLE.goldCard.rings : look.ring ? [{ color: look.ring, width: look.ringWidth ?? DEFAULT_RING_WIDTH }] : [];
    this.ring.active = rings.length > 0;
    let inset = OUTLINE_WIDTH / 2;
    for (const r of rings) {
      const half = inset + r.width / 2;
      rg.strokeColor = hex(r.color);
      rg.lineWidth = r.width;
      rg.roundRect(-this.w / 2 + half, -this.h / 2 + half, this.w - half * 2, this.h - half * 2, Math.max(1, CARD_RADIUS - half));
      rg.stroke();
      inset += r.width;
    }
  }

  private paintRestGlow(glow: GlowSpec | undefined): void {
    this.hasRestGlow = !!glow;
    setGlow(this.restGlow, this.glowW, this.glowH, this.glowRadius, glow);
  }

  /** Exactly one of the card's glows shows: the win halo, the celebrate pulse, or its normal look (none on a card back). */
  private updateGlow(): void {
    this.restGlow.active = this.hasRestGlow && !this.back && !this.winning && !this.celebrating;
    if (this.winGlow) this.winGlow.active = this.winning;
    if (this.pulse) this.pulse.node.active = this.celebrating;
  }

  /** Runs `apply(t)` with t going 0 to 1 every `periodSec`, until its tween is stopped. */
  private loop(phase: Phase, periodSec: number, apply: (t: number) => void): void {
    Tween.stopAllByTarget(phase);
    phase.t = 0;
    tween(phase).repeatForever(tween<Phase>()
      .to(periodSec, { t: 1 }, {
        onUpdate: () => {
          // A card that was removed from the board must not keep animating.
          if (!this.node.isValid || !this.node.parent) { Tween.stopAllByTarget(phase); this.pulse?.stop(); return; }
          apply(phase.t);
        },
      })
      .call(() => { phase.t = 0; })).start();
  }

  private paintFoil(gold: boolean): void {
    this.foil.active = gold;
    Tween.stopAllByTarget(this.foil);
    if (!gold) return;
    const g = this.foil.getComponent(Graphics) ?? this.foil.addComponent(Graphics);
    g.clear();
    g.fillColor = new Color(255, 255, 255, 120);
    g.roundRect(-this.w / 2 + 6, -this.h / 2 + 6, this.w - 12, this.h - 12, 10);
    g.fill();
    const op = this.foil.getComponent(UIOpacity) ?? this.foil.addComponent(UIOpacity);
    op.opacity = 0;
    tween(op).repeatForever(tween<UIOpacity>().delay(1.2).to(0.5, { opacity: 150 }).to(0.7, { opacity: 0 })).start();
  }
}
