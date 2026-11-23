import { Graphics, Node, Tween, tween } from 'cc';
import type { IWinFeedService, WinFeedItem } from '../../shared/game-logic/index';
import { money } from '../../shared/game-logic/index';
import { addGlow } from '../ui/glow';
import { GLOW_STYLE } from '../ui/glowStyle';
import { drawRoundRect, makeLabel, uiNode } from '../ui/uiKit';

/**
 * Winner notification: slides in over the multiplier bar now and then, "gamblingPl*** won ₱55,000".
 * Waits while a win is being shown so it never hides the multiplier. The prototype feed is simulated;
 * production must use real wins from the server.
 */
export class WinnerNotice {
  readonly node: Node;
  private pending: WinFeedItem | null = null;
  private showing = false;
  private poll: ReturnType<typeof setInterval> | undefined;
  private unsubscribe: (() => void) | undefined;
  /** Only one ticker can exist: a new one (for example after a scene reload) replaces the old one. */
  private static current: WinnerNotice | undefined;

  constructor(parent: Node, feed: IWinFeedService, private readonly canShow: () => boolean, private readonly demoTag: boolean, x: number, y: number) {
    this.node = uiNode('WinnerNotice', 640, 70);
    this.node.setPosition(x, y, 0);
    this.node.active = false;
    parent.addChild(this.node);
    WinnerNotice.current?.dispose();
    WinnerNotice.current = this;
    this.unsubscribe = feed.subscribe(item => { this.pending = item; this.tryShow(); });
    feed.start();
    this.poll = setInterval(() => this.tryShow(), 500);
    this.node.on(Node.EventType.NODE_DESTROYED, () => this.dispose());
  }

  /** Stops listening and removes the notice. */
  dispose(): void {
    clearInterval(this.poll);
    this.unsubscribe?.();
    Tween.stopAllByTarget(this.node);
    this.showing = false;
    if (this.node.isValid) this.node.destroy();
    if (WinnerNotice.current === this) WinnerNotice.current = undefined;
  }

  private tryShow(): void {
    if (!this.pending || this.showing || !this.node.isValid || !this.canShow()) return;
    const item = this.pending;
    this.pending = null;
    this.showing = true;
    this.node.removeAllChildren();
    drawRoundRect(this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics), 640, 70, { fill: '#501e78', stroke: '#f5c542', strokeWidth: 3, radius: 35 });
    addGlow(this.node, 'Glow', 640, 70, 35, { glow: GLOW_STYLE.winnerNotice.glow });
    makeLabel(this.node, '🏆', 34, '#f5c542', -285, 0, 50);
    const text = makeLabel(this.node, `${item.name} won ${money(item.amount)}`, 28, '#ffffff', -20, 0, 470);
    text.overflow = 1; // SHRINK
    if (this.demoTag && item.simulated) makeLabel(this.node, 'DEMO', 18, '#ff4f8b', 270, 0, 70);
    this.node.active = true;
    Tween.stopAllByTarget(this.node);
    const x = this.node.position.x, y = this.node.position.y;
    this.node.setPosition(x + 700, y, 0);
    tween(this.node).to(0.45, { position: this.node.position.clone().set(x, y, 0) }, { easing: 'quadOut' })
      .delay(3.6)
      .to(0.35, { position: this.node.position.clone().set(x - 700, y, 0) }, { easing: 'quadIn' })
      .call(() => { this.node.active = false; this.showing = false; this.node.setPosition(x, y, 0); })
      .start();
  }
}
