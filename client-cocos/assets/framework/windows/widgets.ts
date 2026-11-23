import { Graphics, Label, Node } from 'cc';
import { drawRoundRect, hex, makeButton, makeLabel, uiNode } from '../ui/uiKit';

/** Small round − / + style button. */
export function roundButton(parent: Node, text: string, x: number, y: number, onTap: () => void, size = 64): Node {
  const n = uiNode('RoundBtn', size, size);
  n.setPosition(x, y, 0);
  drawRoundRect(n.addComponent(Graphics), size, size, { fill: '#f5c542', stroke: '#3a1f12', strokeWidth: 3, radius: size / 2 });
  makeLabel(n, text, size * 0.6, '#3a1f12', 0, 0, size);
  n.on(Node.EventType.TOUCH_END, onTap);
  parent.addChild(n);
  return n;
}

/** − value + in a row. Returns the value label so the caller can update it. */
export function stepper(parent: Node, x: number, y: number, width: number, onDec: () => void, onInc: () => void): Label {
  roundButton(parent, '−', x - width / 2 + 32, y, onDec);
  roundButton(parent, '+', x + width / 2 - 32, y, onInc);
  return makeLabel(parent, '', 40, '#ffffff', x, y, width - 140);
}

/** A tick box. */
export class TickBox {
  readonly node: Node;
  private readonly g: Graphics;
  private readonly mark: Label;
  constructor(parent: Node, x: number, y: number, private on: boolean, private readonly onChange: (v: boolean) => void) {
    this.node = uiNode('Tick', 56, 56);
    this.node.setPosition(x, y, 0);
    this.g = this.node.addComponent(Graphics);
    this.mark = makeLabel(this.node, '✓', 40, '#3a1f12', 0, 0, 56);
    this.node.on(Node.EventType.TOUCH_END, () => this.set(!this.on));
    parent.addChild(this.node);
    this.paint();
  }
  get value(): boolean { return this.on; }
  set(v: boolean): void { this.on = v; this.paint(); this.onChange(v); }
  private paint(): void {
    drawRoundRect(this.g, 56, 56, { fill: this.on ? '#f5c542' : '#352449', stroke: '#f5c542', strokeWidth: 3, radius: 12 });
    this.mark.node.active = this.on;
  }
}

/** Wide action button used in windows. */
export function actionButton(parent: Node, text: string, x: number, y: number, w: number, primary: boolean, onTap: () => void): { node: Node; label: Label } {
  return makeButton(parent, { w, h: 84, x, y, text, fill: primary ? '#f5c542' : '#3b2a52', textColor: primary ? '#3a1f12' : '#f6efff', fontSize: 34, radius: 42 }, onTap);
}

export { hex };
