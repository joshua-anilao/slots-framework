import { Color, Graphics, Label, Node, Sprite, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import type { SpriteFrame } from 'cc';
import type { Cell } from '../../shared/math-core/index';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';

/** What one symbol looks like. The game supplies it; the framework never knows the theme. */
export interface CardLook {
  /** Card fill (hex). */
  fill: string;
  /** Colour stripe along the bottom edge (hex), if any. */
  accent?: string;
  /** Ring around the card for special symbols (wild, scatter). */
  ring?: string;
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

/**
 * One card on the board: coloured card, symbol sprite, optional word, win ring and dim cover.
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
  private cell: Cell;
  private back = false;

  constructor(private readonly frames: (name: string) => SpriteFrame, private readonly style: ICardStyle,
    private readonly w: number, private readonly h: number, cell: Cell) {
    this.cell = cell;
    this.node = uiNode('Symbol', w, h);
    this.bg = this.node.addComponent(Graphics);
    this.fade = this.node.addComponent(UIOpacity);
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
    this.node.addChild(this.artNode);
    this.node.addChild(this.foil);
    this.node.addChild(this.glyph.node);
    this.node.addChild(this.ring);
    this.node.addChild(this.dimCover);
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
    drawRoundRect(this.bg, this.w, this.h, { fill: g ? '#d4a017' : look.fill, stroke: g ? '#fff6c8' : OUTLINE, strokeWidth: g ? 6 : 4, radius: 14 });
    if (look.accent && !g) {
      this.bg.fillColor = hex(look.accent);
      this.bg.roundRect(-this.w / 2 + 5, -this.h / 2 + 5, this.w - 10, 9, 4);
      this.bg.fill();
    }
    // Ring for wild and scatter.
    const rg = this.ring.getComponent(Graphics) ?? this.ring.addComponent(Graphics);
    rg.clear();
    this.ring.active = !!look.ring;
    if (look.ring) {
      rg.strokeColor = hex(look.ring);
      rg.lineWidth = 5;
      rg.roundRect(-this.w / 2 + 2, -this.h / 2 + 2, this.w - 4, this.h - 4, 12);
      rg.stroke();
    }
    this.art.node.active = true;
    this.art.spriteFrame = this.frames(this.style.frameName(cell));
    const size = this.w * look.artScale;
    this.artNode.getComponent(UITransform)!.setContentSize(size, size);
    this.artNode.setPosition(0, look.glyph ? 10 : 2, 0);
    this.glyph.node.active = !!look.glyph;
    this.glyph.node.setPosition(0, -this.h * 0.3, 0);
    this.glyph.fontSize = 24;
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
    drawRoundRect(this.bg, this.w, this.h, { fill: '#a31818', stroke: '#f5c542', strokeWidth: 8, radius: 14 });
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
    this.glyph.fontSize = 70;
    this.glyph.color = hex('#f5c542');
    this.glyph.node.getComponent(UITransform)!.setContentSize(this.w, 100);
    this.setDim(false);
    this.setWin(false);
  }

  /** Dims a card that is not part of a win. */
  setDim(dim: boolean): void {
    this.dimCover.active = dim;
    if (!dim) return;
    const g = this.dimCover.getComponent(Graphics) ?? this.dimCover.addComponent(Graphics);
    g.clear();
    g.fillColor = new Color(0, 0, 0, 175);
    g.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 14);
    g.fill();
  }

  /** Winning card: bright ring and a slow, wide sway (no scaling). */
  setWin(on: boolean): void {
    Tween.stopAllByTarget(this.node);
    this.node.setPosition(this.node.position.x, this.node.position.y, 0);
    this.node.angle = 0;
    if (!on) return;
    const rg = this.ring.getComponent(Graphics) ?? this.ring.addComponent(Graphics);
    this.ring.active = true;
    rg.clear();
    rg.strokeColor = hex('#ffe066');
    rg.lineWidth = 8;
    rg.roundRect(-this.w / 2 + 1, -this.h / 2 + 1, this.w - 2, this.h - 2, 13);
    rg.stroke();
    tween(this.node).repeatForever(tween<Node>()
      .to(0.25, { angle: -2.5 }, { easing: 'sineInOut' }).to(0.25, { angle: 0 }, { easing: 'sineInOut' })
      .to(0.25, { angle: 2.5 }, { easing: 'sineInOut' }).to(0.25, { angle: 0 }, { easing: 'sineInOut' })).start();
  }

  /** Scatter celebration: a quick shake while the ring pulses. */
  setCelebrate(on: boolean): void {
    if (!on) { this.node.angle = 0; return; }
    tween(this.node).repeatForever(tween<Node>().to(0.12, { angle: -4 }).to(0.12, { angle: 0 }).to(0.12, { angle: 4 }).to(0.12, { angle: 0 })).start();
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
