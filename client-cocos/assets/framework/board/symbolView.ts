import { Graphics, Node, Sprite, UIOpacity, UITransform } from 'cc';
import type { SpriteFrame } from 'cc';
import type { Cell } from '../../shared/math-core/index';
import { drawRoundRect, uiNode } from '../ui/uiKit';

/** What a card looks like for a cell. The game supplies it, the framework never knows the theme. */
export interface ICardStyle {
  /** Background fill (hex) for the cell: normal, golden, wild, scatter. */
  background(cell: Cell): string;
  /** Sprite frame name for the symbol, for example "sym_H1". */
  frameName(cell: Cell): string;
}

/**
 * One card on the board: a coloured rounded card with the symbol sprite on top.
 * Spine-ready: only this class knows how a symbol is drawn, so a skeleton can replace the sprite later.
 */
export class SymbolView {
  readonly node: Node;
  readonly fade: UIOpacity;
  private readonly bg: Graphics;
  private readonly art: Sprite;
  private cell: Cell;

  constructor(private readonly frames: (name: string) => SpriteFrame, private readonly style: ICardStyle, private readonly size: number, cell: Cell) {
    this.cell = cell;
    this.node = uiNode('Symbol', size, size);
    this.bg = this.node.addComponent(Graphics);
    this.fade = this.node.addComponent(UIOpacity);
    const artNode = uiNode('Art', size * 0.86, size * 0.86);
    this.art = artNode.addComponent(Sprite);
    this.art.sizeMode = Sprite.SizeMode.CUSTOM;
    artNode.getComponent(UITransform)!.setContentSize(size * 0.86, size * 0.86);
    this.node.addChild(artNode);
    this.setCell(cell);
  }

  get symbol(): string { return this.cell.s; }

  setCell(cell: Cell): void {
    this.cell = cell;
    drawRoundRect(this.bg, this.size, this.size, { fill: this.style.background(cell), stroke: '#3a1f12', strokeWidth: 4, radius: this.size * 0.14 });
    this.art.spriteFrame = this.frames(this.style.frameName(cell));
  }

  /** Dims a card that is not part of a win. */
  setDim(dim: boolean): void { this.fade.opacity = dim ? 110 : 255; }
}
