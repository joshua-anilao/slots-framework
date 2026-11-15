import { Graphics, Node, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { hex, makeLabel, uiNode } from '../ui/uiKit';

const SPARKS = ['#fff6c8', '#f5c542', '#ffffff'];

/** Effects drawn over the game: sparkle bursts and the win amount that pops up and flies to the WIN box. */
export class FxLayer {
  readonly node: Node;
  private readonly pending = new Set<() => void>();

  constructor(parent: Node, w: number, h: number) {
    this.node = uiNode('Fx', w, h);
    parent.addChild(this.node);
  }

  /** Converts a world position to this layer's space. */
  local(world: Vec3): Vec3 { return this.node.getComponent(UITransform)!.convertToNodeSpaceAR(world); }

  /** A small burst of sparks at each world position. */
  burst(worldCentres: Vec3[], count = 6, colors: string[] = SPARKS): void {
    for (const w of worldCentres) {
      const c = this.local(w);
      for (let i = 0; i < count; i++) {
        const spark = uiNode('Spark', 14, 14);
        const g = spark.addComponent(Graphics);
        g.fillColor = hex(colors[i % colors.length]!);
        g.circle(0, 0, 5 + (i % 3));
        g.fill();
        const op = spark.addComponent(UIOpacity);
        spark.setPosition(c.x, c.y, 0);
        this.node.addChild(spark);
        const a = (Math.PI * 2 * i) / count + (c.x % 1);
        const dist = 38 + (i % 3) * 18;
        tween(spark).to(0.4, { position: new Vec3(c.x + Math.cos(a) * dist, c.y + Math.sin(a) * dist, 0) }, { easing: 'quadOut' }).call(() => spark.destroy()).start();
        tween(op).delay(0.15).to(0.25, { opacity: 0 }).start();
      }
    }
  }

  /**
   * The win amount appears in the middle of the board, big; it pops, settles, then flies to the WIN box.
   * Resolves when it lands. onLand runs at that moment.
   */
  flyWin(text: string, fromWorld: Vec3, toWorld: Vec3, popSec: number, flySec: number, multiplied: boolean): Promise<void> {
    const from = this.local(fromWorld), to = this.local(toWorld);
    const label = makeLabel(this.node, text, multiplied ? 96 : 84, multiplied ? '#ffe066' : '#ffffff', from.x, from.y, 640);
    label.enableOutline = true;
    label.outlineColor = hex('#3a1f12');
    label.outlineWidth = 8;
    const op = label.node.addComponent(UIOpacity);
    label.node.setScale(0.4, 0.4, 1);
    return new Promise(resolve => {
      const done = (): void => { this.pending.delete(done); label.node.destroy(); resolve(); };
      this.pending.add(done);
      tween(label.node)
        .to(popSec * 0.35, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
        .to(popSec * 0.65, { scale: new Vec3(1, 1, 1) }, { easing: 'sineOut' })
        .to(flySec, { position: new Vec3(to.x, to.y, 0), scale: new Vec3(0.35, 0.35, 1) }, { easing: 'quadIn' })
        .call(done).start();
      tween(op).delay(popSec + flySec * 0.7).to(flySec * 0.3, { opacity: 0 }).start();
    });
  }

  /** Removes everything now (tap to skip). */
  clear(): void {
    for (const done of Array.from(this.pending)) done();
    this.node.children.forEach(c => Tween.stopAllByTarget(c));
    this.node.removeAllChildren();
  }
}

