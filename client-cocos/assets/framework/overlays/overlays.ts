import { BlockInputEvents, Color, Graphics, Label, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { STRINGS, money } from '../../shared/game-logic/index';
import type { Pace, WinTier } from '../../shared/game-logic/index';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';

const W = 720, H = 1280;

/** Toasts, banners and the Big/Super/Ultra win overlay. All tap-to-skip. */
export class Overlays {
  readonly node: Node;
  private readonly toastNode: Node;
  private readonly toastLabel: Label;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private skipFn: (() => void) | null = null;

  constructor(parent: Node) {
    this.node = uiNode('Overlays', W, H);
    parent.addChild(this.node);
    this.toastNode = uiNode('Toast', 600, 70);
    this.toastNode.setPosition(0, 330, 0);
    drawRoundRect(this.toastNode.addComponent(Graphics), 600, 70, { fill: '#0a0710', stroke: '#f5c542', radius: 35 });
    this.toastLabel = makeLabel(this.toastNode, '', 26, '#ffffff', 0, 0, 560);
    this.toastNode.active = false;
    this.node.addChild(this.toastNode);
  }

  /** center = big notice in the middle of the screen for messages the player must read (auto spin stopped). */
  toast(text: string, ms = 1600, center = false): void {
    this.toastLabel.string = text;
    this.toastNode.setPosition(0, center ? 0 : 330, 0);
    this.toastNode.active = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastNode.active = false; }, ms);
  }

  /** Called by the presenter's skip(): closes the current banner or finishes a count-up. */
  skip(): void { this.skipFn?.(); }

  /** True while a banner or big win is on screen. */
  get busy(): boolean { return this.skipFn !== null; }

  /** A banner (free spins intro, retrigger). Closes on tap or after `ms`. */
  async banner(title: string, sub: string, ms: number, pace: Pace, extra = ''): Promise<void> {
    const n = this.panel();
    const t = this.fitLabel(makeLabel(n, title, 50, '#f5c542', 0, 150, 660));
    t.enableOutline = true; t.outlineColor = hex('#3a1f12'); t.outlineWidth = 6;
    if (sub) { const s = this.fitLabel(makeLabel(n, sub, 56, '#ffffff', 0, 40, 660)); s.enableOutline = true; s.outlineColor = hex('#3a1f12'); s.outlineWidth = 6; }
    if (extra) this.fitLabel(makeLabel(n, extra, 36, '#f6efff', 0, -70, 660));
    makeLabel(n, STRINGS.tapToContinue, 26, '#b9a8d6', 0, -190, 660, { bold: false });
    await this.holdThenClose(n, pace.hurry ? Math.min(ms, 500) : ms);
  }

  /** Big/Super/Ultra win: count-up that escalates through the tiers it passes. */
  async bigWin(amount: number, bet: number, tiers: { big: number; super: number; ultra: number }, finalTier: WinTier, pace: Pace, onCoin: () => void = () => undefined): Promise<void> {
    const n = this.panel();
    this.coins(n, finalTier === 'ultra' ? 40 : finalTier === 'super' ? 25 : 14);
    const title = this.fitLabel(makeLabel(n, STRINGS.tier.big, 84, '#f5c542', 0, 130, 660));
    title.enableOutline = true; title.outlineColor = hex('#3a1f12'); title.outlineWidth = 8;
    const value = this.fitLabel(makeLabel(n, money(0), 76, '#ffffff', 0, -10, 660));
    value.enableOutline = true; value.outlineColor = hex('#3a1f12'); value.outlineWidth = 8;
    let done = false;
    this.skipFn = () => { done = true; };
    let current: WinTier = 'big';
    const counter = { v: 0 };
    let lastCoin = 0;
    await new Promise<void>(resolve => {
      const ms = pace.t.countUp / 1000;
      const update = (): void => {
        const x = counter.v / bet;
        const tier: WinTier = x >= tiers.ultra ? 'ultra' : x >= tiers.super ? 'super' : 'big';
        value.string = money(counter.v);
        if (tier !== current) {
          current = tier;
          title.string = STRINGS.tier[tier as 'big'];
          title.node.setScale(1.5, 1.5, 1);
          tween(title.node).to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
        }
        const now = Date.now();
        if (!done && now - lastCoin > 90) { lastCoin = now; onCoin(); }
      };
      tween(counter).to(ms, { v: amount }, { easing: 'quadOut', onUpdate: update }).call(() => { counter.v = amount; update(); resolve(); }).start();
      this.skipFn = () => { done = true; Tween.stopAllByTarget(counter); counter.v = amount; update(); resolve(); };
    });
    await this.holdThenClose(n, pace.hurry ? 400 : 1500);
  }

  /** Free spins outro: total counts up with coins, then holds. */
  async countBanner(title: string, sub: string, amount: number, pace: Pace, onCoin: () => void = () => undefined): Promise<void> {
    const n = this.panel();
    this.coins(n, 24);
    const t = this.fitLabel(makeLabel(n, title, 50, '#f5c542', 0, 190, 660));
    t.enableOutline = true; t.outlineColor = hex('#3a1f12'); t.outlineWidth = 6;
    this.fitLabel(makeLabel(n, sub, 40, '#ffffff', 0, 100, 660));
    const value = this.fitLabel(makeLabel(n, money(0), 80, '#ffffff', 0, -10, 660));
    value.enableOutline = true; value.outlineColor = hex('#3a1f12'); value.outlineWidth = 8;
    const counter = { v: 0 };
    let lastCoin = 0;
    await new Promise<void>(resolve => {
      const update = (): void => { value.string = money(counter.v); const now = Date.now(); if (now - lastCoin > 90) { lastCoin = now; onCoin(); } };
      tween(counter).to(pace.t.countUp / 1000, { v: amount }, { easing: 'quadOut', onUpdate: update }).call(() => { counter.v = amount; value.string = money(amount); resolve(); }).start();
      this.skipFn = () => { Tween.stopAllByTarget(counter); counter.v = amount; value.string = money(amount); resolve(); };
    });
    await this.holdThenClose(n, pace.hurry ? 400 : 1600);
  }

  // --- helpers -------------------------------------------------------------------------------

  /** A full-screen dark panel that blocks taps to the game underneath. */
  private panel(): Node {
    const n = uiNode('Panel', W, H);
    n.addComponent(BlockInputEvents);
    const g = n.addComponent(Graphics);
    g.fillColor = new Color(0, 0, 0, 170);
    g.rect(-W / 2, -H / 2, W, H);
    g.fill();
    const op = n.addComponent(UIOpacity);
    op.opacity = 0;
    this.node.addChild(n);
    tween(op).to(0.2, { opacity: 255 }).start();
    return n;
  }

  /** Every line fits the screen width with a margin (text scales with the screen). */
  private fitLabel(l: Label): Label {
    l.overflow = Label.Overflow.SHRINK;
    l.enableWrapText = false;
    return l;
  }

  private coins(parent: Node, count: number): void {
    for (let i = 0; i < count; i++) {
      const c = uiNode('Coin', 36, 36);
      const g = c.addComponent(Graphics);
      g.fillColor = hex('#f5c542'); g.circle(0, 0, 16); g.fill();
      g.strokeColor = hex('#8a6200'); g.lineWidth = 4; g.circle(0, 0, 16); g.stroke();
      const x = (Math.random() - 0.5) * W;
      c.setPosition(x, H / 2 + 40, 0);
      parent.addChild(c);
      const dur = 1 + Math.random();
      tween(c).delay(Math.random() * 1.2).repeatForever(tween<Node>()
        .call(() => c.setPosition(x, H / 2 + 40, 0)).to(dur, { position: new Vec3(x + (Math.random() - 0.5) * 80, -H / 2 - 40, 0) }, { easing: 'quadIn' })).start();
    }
  }

  private holdThenClose(node: Node, ms: number): Promise<void> {
    return new Promise(resolve => {
      let closed = false;
      const close = (): void => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        this.skipFn = null;
        node.off(Node.EventType.TOUCH_END, close);
        const op = node.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(op);
        tween(op).to(0.15, { opacity: 0 }).call(() => { node.children.forEach(c => Tween.stopAllByTarget(c)); node.destroy(); resolve(); }).start();
      };
      const timer = setTimeout(close, ms);
      this.skipFn = close;
      node.on(Node.EventType.TOUCH_END, close);
    });
  }
}
