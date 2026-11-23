import { BlockInputEvents, Color, Graphics, Node, UIOpacity, Vec3, tween } from 'cc';
import { drawRoundRect, hex, makeLabel, uiNode } from '../ui/uiKit';

const W = 720, H = 1280;

export interface ModalOptions {
  /** Dialog in the middle of the screen (pops in) instead of a bottom sheet (slides up). */
  centered?: boolean;
  /** Panel height in design pixels. */
  height: number;
  width?: number;
  onClose?: () => void;
}

/** One popup at a time: dimmed background, title bar with X, close with X or a tap outside. Add content to `body`. */
export class Modal {
  private static current: Modal | null = null;
  /** The popup in front, or null. */
  static get isOpen(): boolean { return Modal.current !== null; }

  readonly root: Node;
  /** Content area, origin at the panel centre. `top` is the y just under the title bar. */
  readonly body: Node;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  private readonly panel: Node;
  private readonly bottomY: number;
  private closing = false;

  constructor(private readonly host: Node, title: string, private readonly o: ModalOptions) {
    this.width = o.width ?? 680;
    this.height = o.height;
    this.root = uiNode('Modal', W, H);
    this.root.addComponent(BlockInputEvents);
    const dim = uiNode('Dim', W, H);
    const dg = dim.addComponent(Graphics);
    dg.fillColor = new Color(0, 0, 0, 170);
    dg.rect(-W / 2, -H / 2, W, H); dg.fill();
    dim.on(Node.EventType.TOUCH_END, () => this.close());
    this.root.addChild(dim);

    this.panel = uiNode('Panel', this.width, this.height);
    this.panel.addComponent(BlockInputEvents);
    drawRoundRect(this.panel.addComponent(Graphics), this.width, this.height, { fill: '#241337', stroke: '#f5c542', strokeWidth: 5, radius: 30 });
    this.bottomY = o.centered ? 0 : -H / 2 + this.height / 2 + 20;
    this.panel.setPosition(0, this.bottomY, 0);
    this.root.addChild(this.panel);

    const head = makeLabel(this.panel, title, 40, '#f5c542', 0, this.height / 2 - 52, this.width - 160);
    head.enableOutline = true; head.outlineColor = hex('#3a1f12'); head.outlineWidth = 5;
    const x = uiNode('Close', 80, 80);
    x.setPosition(this.width / 2 - 56, this.height / 2 - 52, 0);
    drawRoundRect(x.addComponent(Graphics), 56, 56, { fill: '#3b2a52', stroke: '#f5c542', strokeWidth: 3, radius: 28 });
    makeLabel(x, '✕', 30, '#ffffff', 0, 0, 56);
    x.on(Node.EventType.TOUCH_END, () => this.close());
    this.panel.addChild(x);

    this.body = uiNode('Body', this.width, this.height);
    this.panel.addChild(this.body);
    this.top = this.height / 2 - 110;
  }

  open(): this {
    Modal.current?.close();
    Modal.current = this;
    this.host.addChild(this.root);
    const fade = this.root.addComponent(UIOpacity);
    fade.opacity = 0;
    tween(fade).to(0.2, { opacity: 255 }).start();
    if (this.o.centered) {
      this.panel.setScale(0.7, 0.7, 1);
      tween(this.panel).to(0.18, { scale: new Vec3(1.04, 1.04, 1) }, { easing: 'quadOut' }).to(0.08, { scale: new Vec3(1, 1, 1) }).start();
    } else {
      this.panel.setPosition(0, this.bottomY - this.height - 40, 0);
      tween(this.panel).to(0.25, { position: new Vec3(0, this.bottomY + 12, 0) }, { easing: 'quadOut' }).to(0.08, { position: new Vec3(0, this.bottomY, 0) }).start();
    }
    return this;
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
    if (Modal.current === this) Modal.current = null;
    const fade = this.root.getComponent(UIOpacity)!;
    tween(fade).to(0.18, { opacity: 0 }).call(() => this.root.destroy()).start();
    if (this.o.centered) tween(this.panel).to(0.18, { scale: new Vec3(0.85, 0.85, 1) }).start();
    else tween(this.panel).to(0.18, { position: new Vec3(0, this.bottomY - this.height - 40, 0) }).start();
    this.o.onClose?.();
  }
}
