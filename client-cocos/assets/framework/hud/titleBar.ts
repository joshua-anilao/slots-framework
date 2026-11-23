import { Label, LabelShadow, Node, Vec2 } from 'cc';
import { STRINGS } from '../../shared/game-logic/index';
import { withAlpha } from '../ui/glow';
import { GLOW_STYLE } from '../ui/glowStyle';
import type { GlowSpec } from '../ui/glowStyle';
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
    this.logo = makeLabel(this.node, title, 58, '#f5c542', -30, 0, 440);
    this.logo.enableOutline = true; this.logo.outlineColor = hex('#3a1f12'); this.logo.outlineWidth = 6;
    this.logo.overflow = Label.Overflow.SHRINK;
    this.fsGroup = uiNode('FsLeft', 700, 100);
    const fs = GLOW_STYLE.fsTitle;
    const fsLabel = makeLabel(this.fsGroup, STRINGS.freeSpinsLeftLabel, 28, fs.label.color, 0, 28, 640);
    this.addLabelGlow(fsLabel, fs.label.glow);
    this.fsCount = makeLabel(this.fsGroup, '0 / 0', 52, fs.count.color, 0, -16, 640);
    this.fsCount.enableOutline = true; this.fsCount.outlineColor = hex(fs.count.outline); this.fsCount.outlineWidth = 6;
    this.addLabelGlow(this.fsCount, fs.count.glow);
    this.fsGroup.active = false;
    this.node.addChild(this.fsGroup);
    parent.addChild(this.node);
  }

  /** During free spins the game title is replaced by the spins remaining. */
  /** The game screen recolours its background for free spins. */
  onModeChange: (freeSpins: boolean) => void = () => undefined;

  setFreeSpinsMode(on: boolean): void {
    this.onModeChange(on);
    this.logo.node.active = !on;
    this.fsGroup.active = on;
  }

  setFreeSpins(left: number, total: number): void {
    this.fsCount.string = `${left} / ${total}`;
  }

  /** A soft coloured glow around the text: a label shadow with no offset. */
  private addLabelGlow(label: Label, glow: GlowSpec): void {
    const shadow = label.node.addComponent(LabelShadow);
    shadow.color = withAlpha(glow.color, glow.alpha);
    shadow.offset = new Vec2(0, 0);
    shadow.blur = glow.blur;
  }
}
