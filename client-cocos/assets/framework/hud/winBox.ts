import { Graphics, Label, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { money } from '../../shared/game-logic/index';
import { drawRadialGlow } from '../ui/glow';
import { GLOW_STYLE } from '../ui/glowStyle';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';

/** Win row: counts up to the running round win, shows the step note ("12.00 × 3"), pulses when a win lands. */
export class WinBox {
  readonly node: Node;
  readonly valueLabel: Label;
  private readonly note: Label;
  private readonly burst: Node;
  private readonly burstFade: UIOpacity;
  private shown = 0;
  private target = 0;
  private readonly counter = { v: 0 };

  constructor(parent: Node, x: number, y: number) {
    this.node = uiNode('WinBox', 640, 110);
    this.node.setPosition(x, y, 0);
    const pill = uiNode('Pill', 520, 72);
    pill.setPosition(0, 18, 0);
    const pg = pill.addComponent(Graphics);
    drawRoundRect(pg, 520, 72, { fill: '#000000', stroke: '#f5c542', strokeWidth: 2, radius: 36 });
    this.node.addChild(pill);
    // The burst glow sits above the pill and behind the text; one node is reused so bumps never leave strays.
    const b = GLOW_STYLE.winBurst;
    this.burst = uiNode('WinBurst');
    this.burst.setPosition(0, 18, 0);
    drawRadialGlow(this.burst.addComponent(Graphics), b.width / 2, b.stops);
    this.burstFade = this.burst.addComponent(UIOpacity);
    this.burst.active = false;
    this.node.addChild(this.burst);
    makeLabel(this.node, 'WIN', 24, '#b9a8d6', -120, 18, 120);
    this.valueLabel = makeLabel(this.node, money(0), 50, '#ffe37a', 40, 18, 360);
    this.valueLabel.enableOutline = true;
    this.valueLabel.outlineColor = hex('#1f0d00');
    this.valueLabel.outlineWidth = 6;
    this.note = makeLabel(this.node, '', 28, '#ffe37a', 0, -34, 640);
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
    this.playBurst();
  }

  /**
   * A round glow (drawn once as a circle, squashed to the burst's width and height) grows from small to big
   * while it fades out. A new bump restarts the same node.
   */
  private playBurst(): void {
    const b = GLOW_STYLE.winBurst;
    const squash = b.height / b.width;
    const at = (s: number): Vec3 => new Vec3(s, s * squash, 1);
    const total = b.durationMs / 1000;
    const first = total * b.midAt, second = total - first;
    Tween.stopAllByTarget(this.burst);
    Tween.stopAllByTarget(this.burstFade);
    this.burst.active = true;
    this.burst.setScale(at(b.scaleStart));
    this.burstFade.opacity = Math.round(b.opacityStart * 255);
    tween(this.burst)
      .to(first, { scale: at(b.scaleMid) }, { easing: b.easing })
      .to(second, { scale: at(b.scaleEnd) }, { easing: b.easing })
      .call(() => { this.burst.active = false; })
      .start();
    tween(this.burstFade)
      .to(first, { opacity: Math.round(b.opacityMid * 255) }, { easing: b.easing })
      .to(second, { opacity: Math.round(b.opacityEnd * 255) }, { easing: b.easing })
      .start();
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
