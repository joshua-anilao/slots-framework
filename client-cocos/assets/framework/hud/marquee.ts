import { Graphics, Label, Mask, Node, Tween, tween } from 'cc';
import { Color } from 'cc';
import { makeLabel, uiNode } from '../ui/uiKit';

/** The scrolling message strip along the top edge. */
export class Marquee {
  readonly node: Node;

  constructor(parent: Node, text: string, y: number) {
    this.node = uiNode('Marquee', 720, 52);
    this.node.setPosition(0, y, 0);
    const bg = this.node.addComponent(Graphics);
    bg.fillColor = new Color(0, 0, 0, 115); bg.rect(-360, -26, 720, 52); bg.fill();
    const clip = uiNode('Clip', 720, 52);
    clip.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    const approx = text.length * 14;
    const label = makeLabel(clip, text, 26, '#b9a8d6', 0, 0, approx + 40, { bold: false });
    label.overflow = Label.Overflow.NONE;
    // Starts off the right edge and moves left until it has left the left edge, then repeats.
    label.node.setPosition(360 + approx / 2 + 20, 0, 0);
    const from = 360 + approx / 2 + 20, to = -360 - approx / 2 - 20;
    const run = (): void => {
      label.node.setPosition(from, 0, 0);
      tween(label.node).to((from - to) / 90, { position: label.node.position.clone().set(to, 0, 0) }).call(run).start();
    };
    run();
    this.node.addChild(clip);
    parent.addChild(this.node);
    void Tween;
  }
}
