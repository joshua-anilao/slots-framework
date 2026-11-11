import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

/** An empty UI node (on the 2D UI layer, so the UI camera sees it), optionally sized. */
export function uiNode(name: string, width?: number, height?: number): Node {
  const n = new Node(name);
  n.layer = Layers.Enum.UI_2D;
  if (width !== undefined && height !== undefined) n.addComponent(UITransform).setContentSize(width, height);
  return n;
}

export const hex = (c: string): Color => Color.fromHEX(new Color(), c);

export interface RoundRectStyle { fill: string; stroke?: string; strokeWidth?: number; radius?: number }

/** Draws a filled rounded rectangle centred on the node (needs a UITransform of the same size). */
export function drawRoundRect(g: Graphics, w: number, h: number, style: RoundRectStyle): void {
  g.clear();
  g.fillColor = hex(style.fill);
  g.roundRect(-w / 2, -h / 2, w, h, style.radius ?? 16);
  g.fill();
  if (style.stroke) {
    g.strokeColor = hex(style.stroke);
    g.lineWidth = style.strokeWidth ?? 4;
    g.stroke();
  }
}

export function makeLabel(parent: Node, text: string, size: number, color: string, x: number, y: number, width = 640): Label {
  const n = uiNode('Label', width, size * 1.4);
  n.setPosition(x, y, 0);
  const l = n.addComponent(Label);
  l.string = text;
  l.fontSize = size;
  l.lineHeight = Math.round(size * 1.3);
  l.color = hex(color);
  l.horizontalAlign = Label.HorizontalAlign.CENTER;
  l.verticalAlign = Label.VerticalAlign.CENTER;
  l.isBold = true;
  parent.addChild(n);
  return l;
}

export interface ButtonOptions { w: number; h: number; x: number; y: number; text: string; fill: string; textColor: string; fontSize?: number; radius?: number }

/** A tappable rounded button. onTap runs when the finger is lifted on the button. */
export function makeButton(parent: Node, o: ButtonOptions, onTap: () => void): { node: Node; label: Label } {
  const n = uiNode('Button', o.w, o.h);
  n.setPosition(o.x, o.y, 0);
  drawRoundRect(n.addComponent(Graphics), o.w, o.h, { fill: o.fill, stroke: '#3a1f12', radius: o.radius ?? 20 });
  const label = makeLabel(n, o.text, o.fontSize ?? 36, o.textColor, 0, 0, o.w);
  n.on(Node.EventType.TOUCH_END, onTap);
  parent.addChild(n);
  return { node: n, label };
}
