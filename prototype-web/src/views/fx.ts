import { el } from '../core/dom';

/** Free-floating effects above the reels: flying win amounts and particle bursts. */
export class FxLayer {
  readonly root = el('div.fx-layer');

  constructor(private screen: HTMLElement) {}

  /** Touch feedback: a ring and a few sparks wherever the player touches (drawn above everything). */
  touch(clientX: number, clientY: number, layer: HTMLElement): void {
    const s = this.screen.getBoundingClientRect();
    const k = s.width / 720;
    const x = (clientX - s.left) / k;
    const y = (clientY - s.top) / k;
    const ring = el('i.touch-ring');
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    layer.append(ring);
    ring.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }],
      { duration: 450, easing: 'ease-out' }).finished.then(() => ring.remove());
    for (let i = 0; i < 8; i++) {
      const p = el('i.touch-spark');
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      layer.append(p);
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const d = 40 + Math.random() * 30;
      p.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }],
        { duration: 420 + Math.random() * 150, easing: 'cubic-bezier(.1,.7,.4,1)' }).finished.then(() => p.remove());
    }
  }

  /** Centre of an element in design (720x1280) coordinates. */
  centerOf(node: Element): { x: number; y: number } {
    const s = this.screen.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const k = s.width / 720;
    return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k };
  }

  /**
   * Win amount scales up in the middle of the reels, then flies into the WIN box.
   * Resolves when it lands, so the WIN box updates on arrival.
   */
  async flyWin(text: string, from: { x: number; y: number }, to: { x: number; y: number }, popMs: number, flyMs: number, big: boolean): Promise<void> {
    const node = el(`div.fly-win${big ? '.big' : ''}`, { text });
    node.style.left = `${from.x}px`;
    node.style.top = `${from.y}px`;
    this.root.append(node);
    await node.animate([
      { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.35)', opacity: 1, offset: 0.55 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
    ], { duration: popMs, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' }).finished;
    this.sparkle(from.x, from.y, big ? 18 : 10, 140);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    await node.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.45)`, opacity: 0.9 },
    ], { duration: flyMs, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'forwards' }).finished;
    node.remove();
    this.sparkle(to.x, to.y, 8, 70);
  }

  /** Particle burst; `count` grows with the multiplier step for a premium feel. */
  burst(x: number, y: number, count: number, colors = ['#fff6c8', '#f5c542', '#ffb347', '#ffffff']): void {
    for (let i = 0; i < count; i++) {
      const p = el('i.particle');
      const size = 8 + Math.random() * 12;
      p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]}`;
      this.root.append(p);
      const a = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * (80 + count * 4);
      const dur = 500 + Math.random() * 500;
      p.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist + 40}px)) scale(0)`, opacity: 0 },
      ], { duration: dur, easing: 'cubic-bezier(.1,.7,.4,1)' }).finished.then(() => p.remove());
    }
  }

  /** Small twinkles, e.g. where the win lands. */
  sparkle(x: number, y: number, count: number, radius: number): void {
    for (let i = 0; i < count; i++) {
      const s = el('i.twinkle');
      s.style.left = `${x + (Math.random() - 0.5) * radius * 2}px`;
      s.style.top = `${y + (Math.random() - 0.5) * radius}px`;
      this.root.append(s);
      s.animate([{ transform: 'translate(-50%,-50%) scale(0) rotate(0)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.2) rotate(90deg)', opacity: 1, offset: 0.4 },
        { transform: 'translate(-50%,-50%) scale(0) rotate(180deg)', opacity: 0 }], { duration: 450 + Math.random() * 300, delay: Math.random() * 120 })
        .finished.then(() => s.remove());
    }
  }
}
