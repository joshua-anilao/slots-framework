import { Label, Node } from 'cc';
import { STRINGS } from '../../shared/game-logic/index';
import { hex, makeLabel, uiNode } from '../ui/uiKit';

/** The game title, replaced during free spins by "FREE SPINS LEFT 7 / 10". */
export class TitleBar {
  readonly node: Node;
  private readonly logo: Label;
  private readonly fsGroup: Node;
  private readonly fsCount: Label;

  constructor(parent: Node, title: string, x: number, y: number) {
    this.node = uiNode('Title', 700, 100);
    this.node.setPosition(x, y, 0);
    this.logo = makeLabel(this.node, title, 58, '#ffd36b', 0, 0, 640);
    this.logo.enableOutline = true; this.logo.outlineColor = hex('#3a1f12'); this.logo.outlineWidth = 6;
    this.logo.overflow = Label.Overflow.SHRINK;
    this.fsGroup = uiNode('FsLeft', 700, 100);
    makeLabel(this.fsGroup, STRINGS.freeSpinsLeftLabel, 28, '#ffe9b0', 0, 28, 640);
    this.fsCount = makeLabel(this.fsGroup, '0 / 0', 52, '#ffffff', 0, -16, 640);
    this.fsCount.enableOutline = true; this.fsCount.outlineColor = hex('#3a1f12'); this.fsCount.outlineWidth = 6;
    this.fsGroup.active = false;
    this.node.addChild(this.fsGroup);
    parent.addChild(this.node);
  }

  /** During free spins the game title is replaced by the spins remaining. */
  setFreeSpinsMode(on: boolean): void {
    this.logo.node.active = !on;
    this.fsGroup.active = on;
  }

  setFreeSpins(left: number, total: number): void {
    this.fsCount.string = `${left} / ${total}`;
  }
}
