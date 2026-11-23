import { Mask, Node } from 'cc';
import type { EventMouse, EventTouch } from 'cc';
import { uiNode } from './uiKit';

/**
 * A vertical scrolling area: drag with a finger, or use the mouse wheel. Add children to `content`, laid out from the
 * top (y = 0 is the top edge, going down is negative), then call setContentHeight. Row taps should check `dragged`.
 */
export class ScrollPanel {
  readonly node: Node;
  readonly content: Node;
  private contentH = 0;
  private scroll = 0;
  private moved = 0;

  constructor(parent: Node, readonly width: number, readonly height: number, x: number, y: number) {
    this.node = uiNode('Scroll', width, height);
    this.node.setPosition(x, y, 0);
    this.node.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    this.content = uiNode('Content', width, 10);
    this.content.setPosition(0, height / 2, 0);
    this.node.addChild(this.content);
    this.node.on(Node.EventType.TOUCH_START, () => { this.moved = 0; });
    this.node.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => { const dy = e.getUIDelta().y; this.moved += Math.abs(dy); this.by(dy); });
    this.node.on(Node.EventType.MOUSE_WHEEL, (e: EventMouse) => { this.by(-e.getScrollY() * 0.5); });
    parent.addChild(this.node);
  }

  /** True when the last touch was a drag, so a tap on a row should be ignored. */
  get dragged(): boolean { return this.moved > 12; }

  setContentHeight(h: number): void {
    this.contentH = h;
    this.by(0);
  }

  toTop(): void { this.scroll = 0; this.by(0); }

  private by(dy: number): void {
    const max = Math.max(0, this.contentH - this.height);
    this.scroll = Math.min(max, Math.max(0, this.scroll + dy));
    this.content.setPosition(0, this.height / 2 + this.scroll, 0);
  }
}
