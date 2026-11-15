import { Label, Node, Tween, Vec3, tween } from 'cc';
import { money } from '../../shared/game-logic/index';
import { hex, makeLabel, uiNode } from '../ui/uiKit';

/** Win row: counts up to the running round win, shows the step note ("12.00 × 3"), pulses when a win lands. */
export class WinBox {
  readonly node: Node;
  readonly valueLabel: Label;
  private readonly note: Label;
  private shown = 0;
  private target = 0;
  private readonly counter = { v: 0 };

  constructor(parent: Node, x: number, y: number) {
    this.node = uiNode('WinBox', 640, 110);
    this.node.setPosition(x, y, 0);
    makeLabel(this.node, 'WIN', 30, '#ffe9b0', -150, 22, 200);
    this.valueLabel = makeLabel(this.node, money(0), 58, '#ffffff', 40, 18, 420);
    this.valueLabel.enableOutline = true;
    this.valueLabel.outlineColor = hex('#3a1f12');
    this.valueLabel.outlineWidth = 6;
    this.note = makeLabel(this.node, '', 28, '#ffe066', 0, -34, 640);
    parent.addChild(this.node);
  }

  get worldPos(): Vec3 { return this.valueLabel.node.getWorldPosition(); }

  /** Only moves up (a late fly-in can't lower a newer total). */
  raise(amount: number, seconds = 0): void {
    if (amount > this.target) this.set(amount, seconds);
  }

  /** The WIN row pulses when a win lands in it. */
  bump(): void {
    Tween.stopAllByTarget(this.valueLabel.node);
    this.valueLabel.node.setScale(1, 1, 1);
    tween(this.valueLabel.node).to(0.12, { scale: new Vec3(1.15, 1.15, 1) }).to(0.15, { scale: new Vec3(1, 1, 1) }).start();
  }

  set(amount: number, seconds = 0): void {
    this.target = amount;
    Tween.stopAllByTarget(this.counter);
    const from = this.shown;
    if (seconds <= 0 || amount <= from) { this.show(amount); return; }
    this.counter.v = from;
    tween(this.counter).to(seconds, { v: amount }, { onUpdate: () => this.show(this.counter.v) }).call(() => this.show(amount)).start();
  }

  setNote(text: string): void { this.note.string = text; }

  private show(v: number): void {
    this.shown = v;
    this.valueLabel.string = money(v);
  }
}
